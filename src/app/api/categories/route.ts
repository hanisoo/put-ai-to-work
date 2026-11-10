import { NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { jsonError, requireUser } from "@/lib/api";
import { validateCategoryInput, isUniqueViolation } from "@/lib/category-input";

export async function GET() {
  const { error } = await requireUser();
  if (error) return error;

  const rows = await db
    .select({ id: categories.id, name: categories.name, description: categories.description })
    .from(categories)
    .orderBy(asc(categories.id));
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const { error } = await requireUser();
  if (error) return error;

  const parsed = validateCategoryInput(await request.json().catch(() => null));
  if ("error" in parsed) return jsonError(parsed.error, 400);

  try {
    const [row] = await db
      .insert(categories)
      .values(parsed)
      .returning({ id: categories.id, name: categories.name, description: categories.description });
    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    if (isUniqueViolation(err)) return jsonError("같은 이름의 카테고리가 이미 있습니다.", 409);
    throw err;
  }
}
