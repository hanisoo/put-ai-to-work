import { NextResponse } from "next/server";
import { jsonError, requireUser } from "@/lib/api";
import { getConnection, parseNotionPageId, saveConnection } from "@/lib/notion-oauth";
import type { NotionStatusDTO } from "@/lib/types";

async function status(): Promise<NotionStatusDTO> {
  const conn = await getConnection();
  return {
    connected: Boolean(conn?.accessToken),
    parentPageId: conn?.parentPageId ?? null,
    expiresAt: conn?.expiresAt?.toISOString() ?? null,
  };
}

export async function GET() {
  const { error } = await requireUser();
  if (error) return error;
  return NextResponse.json(await status());
}

export async function PATCH(request: Request) {
  const { error } = await requireUser();
  if (error) return error;

  const body = (await request.json().catch(() => null)) as { parentPage?: unknown } | null;
  const input = typeof body?.parentPage === "string" ? body.parentPage : "";
  const pageId = parseNotionPageId(input);
  if (!pageId) {
    return jsonError("Notion 페이지 URL 또는 ID를 확인해 주세요. (32자리 ID가 포함되어야 합니다)", 400);
  }

  await saveConnection({ parentPageId: pageId });
  return NextResponse.json(await status());
}
