import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { jsonError, requireUser } from "@/lib/api";
import { isUniqueViolation, validateCategoryInput } from "@/lib/category-input";

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/categories/[id]">) {
  const { error } = await requireUser();
  if (error) return error;

  const id = parseId((await ctx.params).id);
  if (!id) return jsonError("잘못된 카테고리 ID입니다.", 400);

  const parsed = validateCategoryInput(await request.json().catch(() => null));
  if ("error" in parsed) return jsonError(parsed.error, 400);

  try {
    const [row] = await db
      .update(categories)
      .set({ ...parsed, updatedAt: new Date() })
      .where(eq(categories.id, id))
      .returning({ id: categories.id, name: categories.name, description: categories.description });
    if (!row) return jsonError("카테고리를 찾을 수 없습니다.", 404);
    return NextResponse.json(row);
  } catch (err) {
    if (isUniqueViolation(err)) return jsonError("같은 이름의 카테고리가 이미 있습니다.", 409);
    throw err;
  }
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/categories/[id]">) {
  const { error } = await requireUser();
  if (error) return error;

  const id = parseId((await ctx.params).id);
  if (!id) return jsonError("잘못된 카테고리 ID입니다.", 400);

  // articles.category_id는 FK ON DELETE SET NULL → 해당 뉴스는 '미분류'가 된다.
  const deleted = await db
    .delete(categories)
    .where(eq(categories.id, id))
    .returning({ id: categories.id });
  if (deleted.length === 0) return jsonError("카테고리를 찾을 수 없습니다.", 404);
  return NextResponse.json({ ok: true });
}
