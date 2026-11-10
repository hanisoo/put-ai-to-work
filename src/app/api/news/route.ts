import { NextResponse, type NextRequest } from "next/server";
import { desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { articles, categories, notionSaves } from "@/db/schema";
import { jsonError, requireUser } from "@/lib/api";
import type { ArticleDTO } from "@/lib/types";

const LIMIT = 300;

export async function GET(request: NextRequest) {
  const { error } = await requireUser();
  if (error) return error;

  const filter = request.nextUrl.searchParams.get("category");
  let where;
  if (filter === "uncategorized") {
    where = isNull(articles.categoryId);
  } else if (filter && filter !== "all") {
    const id = Number(filter);
    if (!Number.isInteger(id)) return jsonError("잘못된 카테고리입니다.", 400);
    where = eq(articles.categoryId, id);
  }

  const rows = await db
    .select({
      id: articles.id,
      url: articles.url,
      source: articles.source,
      originalTitle: articles.originalTitle,
      titleKo: articles.titleKo,
      summaryKo: articles.summaryKo,
      categoryId: articles.categoryId,
      categoryName: categories.name,
      imageUrl: articles.imageUrl,
      publishedAt: articles.publishedAt,
    })
    .from(articles)
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .where(where)
    .orderBy(desc(articles.publishedAt), desc(articles.id))
    .limit(LIMIT);

  const saves = rows.length
    ? await db
        .select({ articleId: notionSaves.articleId, url: notionSaves.notionPageUrl })
        .from(notionSaves)
        .where(inArray(notionSaves.articleId, rows.map((r) => r.id)))
        .orderBy(desc(notionSaves.createdAt))
    : [];
  const saveMap = new Map<number, string>();
  for (const s of saves) if (!saveMap.has(s.articleId)) saveMap.set(s.articleId, s.url);

  const data: ArticleDTO[] = rows.map((r) => ({
    ...r,
    publishedAt: r.publishedAt.toISOString(),
    notionPageUrl: saveMap.get(r.id) ?? null,
  }));
  return NextResponse.json(data);
}
