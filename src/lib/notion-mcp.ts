import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { client, FALLBACK_BETA, MODEL } from "./claude";
import {
  getValidAccessToken,
  NOTION_MCP_URL,
  NotionReconnectError,
  refreshAccessToken,
} from "./notion-oauth";
import { SOURCE_LABELS } from "./source-labels";
import type { NewsSource } from "./types";

const MCP_BETA = "mcp-client-2025-11-20";
const MCP_SERVER_NAME = "notion";
const MAX_CONTINUATIONS = 5;

export interface NotionArticleInput {
  titleKo: string;
  summaryKo: string;
  categoryName: string;
  source: NewsSource;
  url: string;
  publishedAt: Date;
}

const SYSTEM = `당신은 Notion MCP 도구로 뉴스 기사를 Notion에 저장하는 도우미입니다.
지정된 상위 페이지 아래에 새 페이지를 정확히 하나 만듭니다.
- 페이지 제목: 기사 제목
- 본문: "요약" 문단, 그리고 카테고리·출처·발행일·원문 링크를 담은 목록
다른 페이지는 수정하거나 만들지 않습니다.
작업이 끝나면 만든 페이지의 URL만 한 줄로 답합니다.`;

// Notion 페이지 URL: https://app.notion.com/p/<id>, https://www.notion.so/<slug-id>, *.notion.site 등
const NOTION_URL_RE =
  /https:\/\/(?:[a-z0-9-]+\.)?notion\.(?:com|so|site)\/[^\s)"'<>\]\\]*[0-9a-f]{32}[^\s)"'<>\]\\]*/gi;

function isMcpAuthError(err: unknown): boolean {
  return (
    err instanceof Anthropic.APIError &&
    (err.status === 400 || err.status === 401 || err.status === 403) &&
    /unauthori|authenticat|401|token/i.test(err.message)
  );
}

/** 텍스트에서 상위 페이지가 아닌 마지막 Notion 페이지 URL을 찾는다. */
function lastPageUrl(text: string, parentId: string): string | null {
  const urls = [...text.matchAll(NOTION_URL_RE)]
    .map((m) => m[0])
    .filter((u) => !u.toLowerCase().includes(parentId));
  return urls.at(-1) ?? null;
}

export function findNotionUrl(
  content: Anthropic.Beta.BetaContentBlock[],
  parentPageId: string,
): string | null {
  const parentId = parentPageId.replace(/-/g, "").toLowerCase();
  // 최종 답변 텍스트를 먼저 보고, 없으면 MCP 도구 결과 전체에서 찾는다.
  for (const block of [...content].reverse()) {
    if (block.type === "text") {
      const url = lastPageUrl(block.text, parentId);
      if (url) return url;
    }
  }
  return lastPageUrl(JSON.stringify(content), parentId);
}

async function runSave(
  token: string,
  parentPageId: string,
  article: NotionArticleInput,
): Promise<string> {
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: "user",
      content: `상위 페이지 ID: ${parentPageId}

기사 정보(JSON):
${JSON.stringify({
  title: article.titleKo,
  summary: article.summaryKo,
  category: article.categoryName,
  source: SOURCE_LABELS[article.source],
  publishedAt: article.publishedAt.toISOString().slice(0, 10),
  url: article.url,
})}`,
    },
  ];

  for (let i = 0; i <= MAX_CONTINUATIONS; i++) {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: [MCP_BETA, FALLBACK_BETA],
      fallbacks: "default",
      output_config: { effort: "medium" },
      system: SYSTEM,
      mcp_servers: [
        {
          type: "url",
          url: NOTION_MCP_URL,
          name: MCP_SERVER_NAME,
          authorization_token: token,
        },
      ],
      tools: [{ type: "mcp_toolset", mcp_server_name: MCP_SERVER_NAME }],
      messages,
    });

    if (response.stop_reason === "refusal") {
      throw new Error("Claude가 요청을 처리하지 못했습니다.");
    }
    if (response.stop_reason === "pause_turn") {
      // 서버 측 도구 루프가 일시 중단됨: 응답을 그대로 이어 붙여 계속 진행한다.
      messages.push({ role: "assistant", content: response.content });
      continue;
    }

    const url = findNotionUrl(response.content, parentPageId);
    if (!url) {
      console.error("[notion] page URL not found in response:", JSON.stringify(response.content).slice(0, 4000));
      throw new Error("Notion 페이지는 만들었을 수 있지만 URL을 확인하지 못했습니다.");
    }
    return url;
  }
  throw new Error("Notion 저장이 너무 오래 걸려 중단했습니다.");
}

/** Claude API + Notion MCP로 상위 페이지 아래에 기사 페이지를 만들고 URL을 돌려준다. */
export async function saveArticleToNotion(
  parentPageId: string,
  article: NotionArticleInput,
): Promise<string> {
  const token = await getValidAccessToken();
  try {
    return await runSave(token, parentPageId, article);
  } catch (err) {
    if (!isMcpAuthError(err)) throw err;
    // 토큰이 서버 측에서 무효화된 경우: 한 번 갱신 후 재시도
    const fresh = await refreshAccessToken();
    try {
      return await runSave(fresh, parentPageId, article);
    } catch (retryErr) {
      if (isMcpAuthError(retryErr)) throw new NotionReconnectError();
      throw retryErr;
    }
  }
}
