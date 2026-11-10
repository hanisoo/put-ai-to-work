import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { CategoryDTO, FeedItem } from "./types";
import { UNCATEGORIZED } from "./types";

export const client = new Anthropic();
export const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

/**
 * 안전 분류기가 요청을 거절하면 서버가 다른 모델로 자동 재시도한다.
 * "default"를 지원하지 않는 모델에서는 요청 모델만으로 실행되므로 항상 보내도 안전하다.
 */
export const FALLBACK_BETA = "server-side-fallback-2026-07-01";

const PROCESS_BATCH_SIZE = 8;
const RECLASSIFY_BATCH_SIZE = 25;
const CONCURRENCY = 3;

function categoryEnum(categories: CategoryDTO[]) {
  const names = [...new Set([...categories.map((c) => c.name), UNCATEGORIZED])];
  return z.enum(names as [string, ...string[]]);
}

function categoryGuide(categories: CategoryDTO[]): string {
  const lines = categories.map(
    (c) => `- ${c.name}${c.description ? `: ${c.description}` : ""}`,
  );
  lines.push(`- ${UNCATEGORIZED}: 위 카테고리 어디에도 맞지 않을 때만 사용`);
  return lines.join("\n");
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** 사용자에게 보여줄 오류 사유 (API 오류는 API가 준 메시지를 그대로 쓴다) */
function describeError(err: unknown): string {
  if (err instanceof Anthropic.APIError) {
    const apiMessage = (err.error as { error?: { message?: string } } | undefined)?.error?.message;
    return `Claude API 오류 (${err.status ?? "연결 실패"}): ${apiMessage ?? err.message}`;
  }
  return err instanceof Error ? err.message : String(err);
}

/** 재시도해도 같은 결과가 나오는 오류(인증·권한·잔액 등 4xx, 단 429 제외)인지 */
function isFatal(err: unknown): boolean {
  return (
    err instanceof Anthropic.APIError &&
    err.status !== undefined &&
    err.status >= 400 &&
    err.status < 500 &&
    err.status !== 408 &&
    err.status !== 429
  );
}

/**
 * 배치를 동시에 최대 CONCURRENCY개씩 처리한다. 실패한 배치는 null.
 * 인증·잔액 부족 같은 치명적 오류가 나면 남은 배치는 호출하지 않는다.
 */
async function runBatches<T, R>(
  batches: T[][],
  worker: (batch: T[]) => Promise<R>,
): Promise<{ results: (R | null)[]; errors: string[] }> {
  const results: (R | null)[] = new Array(batches.length).fill(null);
  const errors = new Set<string>();
  let next = 0;
  let stopped = false;
  async function lane() {
    while (!stopped && next < batches.length) {
      const i = next++;
      try {
        results[i] = await worker(batches[i]);
      } catch (err) {
        console.error(`[claude] batch ${i} failed:`, err);
        errors.add(describeError(err));
        if (isFatal(err)) stopped = true;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batches.length) }, lane));
  return { results, errors: [...errors] };
}

export interface ProcessedArticle {
  titleKo: string;
  summaryKo: string;
  categoryName: string;
}

const PROCESS_SYSTEM = `당신은 해외 AI 뉴스를 한국 독자에게 전하는 편집자입니다.
각 기사에 대해 다음을 작성합니다.
- titleKo: 자연스러운 한국어 기사 제목. 고유명사(회사·제품·인물명)는 널리 쓰이는 표기를 따르고, 필요하면 원어를 유지합니다.
- summaryKo: 핵심 내용을 담은 한국어 요약 3~4문장. 주어진 원문 정보에 없는 사실은 추가하지 않습니다.
- category: 주어진 카테고리 목록 중 가장 알맞은 하나의 이름을 그대로 씁니다.
입력의 모든 기사에 대해 같은 index로 결과를 하나씩 돌려줍니다.`;

/**
 * 새 기사를 배치로 묶어 번역·요약·분류한다.
 * results는 입력과 같은 순서이며, 처리에 실패한 기사는 null이다. errors는 실패 사유 목록.
 */
export async function processArticles(
  items: FeedItem[],
  categories: CategoryDTO[],
): Promise<{ results: (ProcessedArticle | null)[]; errors: string[] }> {
  if (items.length === 0) return { results: [], errors: [] };

  const schema = z.object({
    results: z.array(
      z.object({
        index: z.number().int(),
        titleKo: z.string(),
        summaryKo: z.string(),
        category: categoryEnum(categories),
      }),
    ),
  });

  const batches = chunk(
    items.map((item, index) => ({ item, index })),
    PROCESS_BATCH_SIZE,
  );

  const { results: batchResults, errors } = await runBatches(batches, async (batch) => {
    const payload = batch.map(({ item, index }) => ({
      index,
      title: item.originalTitle,
      content: item.snippet,
    }));

    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(schema) },
      system: PROCESS_SYSTEM,
      messages: [
        {
          role: "user",
          content: `카테고리 목록:\n${categoryGuide(categories)}\n\n기사 목록(JSON):\n${JSON.stringify(payload)}`,
        },
      ],
    });

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      throw new Error(`처리 실패 (stop_reason: ${response.stop_reason})`);
    }
    return response.parsed_output.results;
  });

  const out: (ProcessedArticle | null)[] = new Array(items.length).fill(null);
  for (const results of batchResults) {
    if (!results) continue;
    for (const r of results) {
      if (r.index < 0 || r.index >= items.length) continue;
      if (!r.titleKo.trim() || !r.summaryKo.trim()) continue;
      out[r.index] = {
        titleKo: r.titleKo.trim(),
        summaryKo: r.summaryKo.trim(),
        categoryName: r.category,
      };
    }
  }
  return { results: out, errors };
}

const RECLASSIFY_SYSTEM = `당신은 AI 뉴스 분류 담당자입니다.
각 기사의 한국어 제목과 요약을 보고, 주어진 카테고리 목록 중 가장 알맞은 하나의 이름을 그대로 고릅니다.
입력의 모든 기사에 대해 같은 id로 결과를 하나씩 돌려줍니다.`;

/** 저장된 한국어 제목·요약만으로 다시 분류한다. 반환: articleId → 카테고리 이름 */
export async function reclassifyArticles(
  articles: { id: number; titleKo: string; summaryKo: string }[],
  categories: CategoryDTO[],
): Promise<{ assignments: Map<number, string>; failed: number; errors: string[] }> {
  const schema = z.object({
    results: z.array(z.object({ id: z.number().int(), category: categoryEnum(categories) })),
  });

  const batches = chunk(articles, RECLASSIFY_BATCH_SIZE);
  const { results: batchResults, errors } = await runBatches(batches, async (batch) => {
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 8000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(schema) },
      system: RECLASSIFY_SYSTEM,
      messages: [
        {
          role: "user",
          content: `카테고리 목록:\n${categoryGuide(categories)}\n\n기사 목록(JSON):\n${JSON.stringify(
            batch.map((a) => ({ id: a.id, title: a.titleKo, summary: a.summaryKo })),
          )}`,
        },
      ],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      throw new Error(`재분류 실패 (stop_reason: ${response.stop_reason})`);
    }
    return response.parsed_output.results;
  });

  const validIds = new Set(articles.map((a) => a.id));
  const assignments = new Map<number, string>();
  for (const results of batchResults) {
    for (const r of results ?? []) {
      if (validIds.has(r.id)) assignments.set(r.id, r.category);
    }
  }
  return { assignments, failed: articles.length - assignments.size, errors };
}
