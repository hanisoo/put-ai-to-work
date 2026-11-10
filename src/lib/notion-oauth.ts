import "server-only";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { notionConnection, type NotionConnection } from "@/db/schema";

export const NOTION_MCP_URL = "https://mcp.notion.com/mcp";
const CONNECTION_ID = 1;

export class NotionReconnectError extends Error {
  constructor(message = "Notion 연결이 만료되었습니다. 설정 화면에서 다시 연결해 주세요.") {
    super(message);
    this.name = "NotionReconnectError";
  }
}

export class NotionNotConnectedError extends Error {
  constructor() {
    super("Notion이 연결되지 않았습니다. 설정 화면에서 먼저 연결해 주세요.");
    this.name = "NotionNotConnectedError";
  }
}

interface AuthServerMetadata {
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint?: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}

export function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function redirectUri(): string {
  return `${appUrl()}/api/notion/callback`;
}

/* ---------------- 디스커버리 ---------------- */

let metadataCache: AuthServerMetadata | null = null;

async function getJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  return res.ok ? ((await res.json()) as T) : null;
}

/** MCP 서버의 보호 리소스 메타데이터 → 인가 서버 메타데이터 순으로 찾는다. */
export async function discoverAuthServer(): Promise<AuthServerMetadata> {
  if (metadataCache) return metadataCache;

  const mcp = new URL(NOTION_MCP_URL);
  const prm =
    (await getJson<{ authorization_servers?: string[] }>(
      `${mcp.origin}/.well-known/oauth-protected-resource${mcp.pathname}`,
    )) ??
    (await getJson<{ authorization_servers?: string[] }>(
      `${mcp.origin}/.well-known/oauth-protected-resource`,
    ));

  const issuer = new URL(prm?.authorization_servers?.[0] ?? mcp.origin);
  const issuerPath = issuer.pathname === "/" ? "" : issuer.pathname;
  const metadata =
    (await getJson<AuthServerMetadata>(
      `${issuer.origin}/.well-known/oauth-authorization-server${issuerPath}`,
    )) ??
    (await getJson<AuthServerMetadata>(
      `${issuer.origin}/.well-known/openid-configuration${issuerPath}`,
    ));

  if (!metadata?.authorization_endpoint || !metadata.token_endpoint) {
    throw new Error("Notion OAuth 인가 서버 정보를 찾지 못했습니다.");
  }
  metadataCache = metadata;
  return metadata;
}

/* ---------------- 저장소 ---------------- */

export async function getConnection(): Promise<NotionConnection | null> {
  const rows = await db
    .select()
    .from(notionConnection)
    .where(eq(notionConnection.id, CONNECTION_ID))
    .limit(1);
  return rows[0] ?? null;
}

export async function saveConnection(
  values: Partial<Omit<NotionConnection, "id" | "updatedAt">>,
): Promise<void> {
  const data = { ...values, updatedAt: new Date() };
  await db
    .insert(notionConnection)
    .values({ id: CONNECTION_ID, ...data })
    .onConflictDoUpdate({ target: notionConnection.id, set: data });
}

/* ---------------- DCR ---------------- */

/** 등록된 클라이언트가 없으면 동적 클라이언트 등록(DCR)을 한다. */
async function ensureClient(
  metadata: AuthServerMetadata,
): Promise<{ clientId: string; clientSecret: string | null }> {
  const existing = await getConnection();
  if (existing?.clientId) {
    return { clientId: existing.clientId, clientSecret: existing.clientSecret };
  }
  if (!metadata.registration_endpoint) {
    throw new Error("Notion 인가 서버가 동적 클라이언트 등록을 지원하지 않습니다.");
  }

  const res = await fetch(metadata.registration_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_name: "AI News Collector",
      redirect_uris: [redirectUri()],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    }),
  });
  if (!res.ok) {
    throw new Error(`Notion 클라이언트 등록 실패 (HTTP ${res.status}): ${await res.text()}`);
  }
  const body = (await res.json()) as { client_id: string; client_secret?: string };
  const clientSecret = body.client_secret ?? null;
  await saveConnection({ clientId: body.client_id, clientSecret });
  return { clientId: body.client_id, clientSecret };
}

/* ---------------- PKCE / 인가 ---------------- */

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export interface PendingAuth {
  state: string;
  verifier: string;
}

export async function buildAuthorizationUrl(): Promise<{ url: string; pending: PendingAuth }> {
  const metadata = await discoverAuthServer();
  const { clientId } = await ensureClient(metadata);

  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(crypto.createHash("sha256").update(verifier).digest());
  const state = base64url(crypto.randomBytes(16));

  const url = new URL(metadata.authorization_endpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri());
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", state);
  url.searchParams.set("resource", NOTION_MCP_URL);

  return { url: url.toString(), pending: { state, verifier } };
}

/* ---------------- 토큰 ---------------- */

async function requestToken(params: Record<string, string>): Promise<TokenResponse> {
  const metadata = await discoverAuthServer();
  const conn = await getConnection();
  if (!conn?.clientId) throw new NotionNotConnectedError();

  const body = new URLSearchParams({ ...params, client_id: conn.clientId, resource: NOTION_MCP_URL });
  if (conn.clientSecret) body.set("client_secret", conn.clientSecret);

  const res = await fetch(metadata.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Notion 토큰 요청 실패 (HTTP ${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as TokenResponse;
}

async function storeTokens(token: TokenResponse, previousRefresh: string | null): Promise<void> {
  await saveConnection({
    accessToken: token.access_token,
    // 갱신 응답에 새 refresh token이 없으면 기존 것을 유지한다.
    refreshToken: token.refresh_token ?? previousRefresh,
    expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null,
  });
}

export async function exchangeCode(code: string, verifier: string): Promise<void> {
  const token = await requestToken({
    grant_type: "authorization_code",
    code,
    code_verifier: verifier,
    redirect_uri: redirectUri(),
  });
  await storeTokens(token, null);
}

const REFRESH_MARGIN_MS = 60_000;

/** 유효한 access token을 돌려준다. 만료가 가까우면 refresh token으로 갱신한다. */
export async function getValidAccessToken(): Promise<string> {
  const conn = await getConnection();
  if (!conn?.accessToken) throw new NotionNotConnectedError();

  const expiring =
    conn.expiresAt && conn.expiresAt.getTime() - REFRESH_MARGIN_MS < Date.now();
  if (!expiring) return conn.accessToken;

  return refreshAccessToken();
}

/** 강제로 토큰을 갱신한다. 실패하면 연결을 끊고 재연결을 안내한다. */
export async function refreshAccessToken(): Promise<string> {
  const conn = await getConnection();
  if (!conn?.refreshToken) {
    await saveConnection({ accessToken: null, expiresAt: null });
    throw new NotionReconnectError();
  }
  try {
    const token = await requestToken({
      grant_type: "refresh_token",
      refresh_token: conn.refreshToken,
    });
    await storeTokens(token, conn.refreshToken);
    return token.access_token;
  } catch (err) {
    console.error("[notion] token refresh failed:", err);
    await saveConnection({ accessToken: null, refreshToken: null, expiresAt: null });
    throw new NotionReconnectError();
  }
}

/** Notion 페이지 URL 또는 ID에서 페이지 ID(대시 포함 UUID)를 뽑는다. */
export function parseNotionPageId(input: string): string | null {
  const trimmed = input.trim();
  const dashed = trimmed.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
  );
  const raw = dashed
    ? dashed[0].replace(/-/g, "")
    : (trimmed.split("?")[0].match(/[0-9a-f]{32}(?=[^0-9a-f]*$)/i)?.[0] ?? null);
  if (!raw) return null;
  const h = raw.toLowerCase();
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
