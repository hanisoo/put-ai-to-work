import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { articles, categories, notionSaves } from "@/db/schema";
import { errorMessage, jsonError, requireUser } from "@/lib/api";
import { saveArticleToNotion } from "@/lib/notion-mcp";
import {
  getConnection,
  NotionNotConnectedError,
  NotionReconnectError,
} from "@/lib/notion-oauth";
import { UNCATEGORIZED } from "@/lib/types";

export const maxDuration = 300;

export async function POST(request: Request) {
  const { userId, error } = await requireUser();
  if (error) return error;

  const body = (await request.json().catch(() => null)) as { articleId?: unknown } | null;
  const articleId = Number(body?.articleId);
  if (!Number.isInteger(articleId)) return jsonError("잘못된 기사 ID입니다.", 400);

  const conn = await getConnection();
  if (!conn?.accessToken) {
    return jsonError(new NotionNotConnectedError().message, 409, { reconnect: true });
  }
  if (!conn.parentPageId) {
    return jsonError("설정 화면에서 기사를 저장할 Notion 상위 페이지를 먼저 지정해 주세요.", 409);
  }

  const [article] = await db
    .select({
      id: articles.id,
      url: articles.url,
      source: articles.source,
      titleKo: articles.titleKo,
      summaryKo: articles.summaryKo,
      publishedAt: articles.publishedAt,
      categoryName: categories.name,
    })
    .from(articles)
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .where(eq(articles.id, articleId))
    .limit(1);
  if (!article) return jsonError("기사를 찾을 수 없습니다.", 404);

  try {
    const notionPageUrl = await saveArticleToNotion(conn.parentPageId, {
      ...article,
      categoryName: article.categoryName ?? UNCATEGORIZED,
    });
    await db.insert(notionSaves).values({ articleId, notionPageUrl, savedBy: userId });
    return NextResponse.json({ notionPageUrl });
  } catch (err) {
    if (err instanceof NotionReconnectError || err instanceof NotionNotConnectedError) {
      return jsonError(err.message, 409, { reconnect: true });
    }
    console.error("[notion/save]", err);
    return jsonError(`Notion 저장에 실패했습니다: ${errorMessage(err)}`, 502);
  }
}
