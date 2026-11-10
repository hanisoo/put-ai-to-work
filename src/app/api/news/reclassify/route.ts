import { NextResponse } from "next/server";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { articles, categories } from "@/db/schema";
import { errorMessage, jsonError, requireUser } from "@/lib/api";
import { reclassifyArticles } from "@/lib/claude";

export const maxDuration = 300;

export async function POST() {
  const { error } = await requireUser();
  if (error) return error;

  try {
    const [cats, all] = await Promise.all([
      db
        .select({ id: categories.id, name: categories.name, description: categories.description })
        .from(categories),
      db
        .select({
          id: articles.id,
          titleKo: articles.titleKo,
          summaryKo: articles.summaryKo,
          categoryId: articles.categoryId,
        })
        .from(articles),
    ]);
    if (all.length === 0) return NextResponse.json({ total: 0, changed: 0, failed: 0 });

    const idByName = new Map(cats.map((c) => [c.name, c.id]));
    const { assignments, failed, errors } = await reclassifyArticles(all, cats);

    // 바뀐 기사만 카테고리별로 묶어 갱신한다.
    const groups = new Map<number | null, number[]>();
    for (const a of all) {
      const name = assignments.get(a.id);
      if (name === undefined) continue;
      const next = idByName.get(name) ?? null;
      if (next === a.categoryId) continue;
      groups.set(next, [...(groups.get(next) ?? []), a.id]);
    }

    let changed = 0;
    for (const [categoryId, ids] of groups) {
      await db.update(articles).set({ categoryId }).where(inArray(articles.id, ids));
      changed += ids.length;
    }

    return NextResponse.json({ total: all.length, changed, failed, failReasons: errors });
  } catch (err) {
    console.error("[news/reclassify]", err);
    return jsonError(`재분류에 실패했습니다: ${errorMessage(err)}`, 500);
  }
}
