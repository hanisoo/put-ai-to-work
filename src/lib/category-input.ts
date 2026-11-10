import { UNCATEGORIZED } from "@/lib/types";

const RESERVED = new Set([UNCATEGORIZED, "전체"]);

export function validateCategoryInput(
  body: unknown,
): { name: string; description: string } | { error: string } {
  if (!body || typeof body !== "object") return { error: "요청 형식이 올바르지 않습니다." };
  const { name, description } = body as { name?: unknown; description?: unknown };

  const n = typeof name === "string" ? name.trim() : "";
  if (!n) return { error: "카테고리 이름을 입력해 주세요." };
  if (n.length > 30) return { error: "카테고리 이름은 30자 이하로 입력해 주세요." };
  if (RESERVED.has(n)) return { error: `'${n}'은(는) 예약된 이름이라 사용할 수 없습니다.` };

  const d = typeof description === "string" ? description.trim() : "";
  if (d.length > 300) return { error: "설명은 300자 이하로 입력해 주세요." };

  return { name: n, description: d };
}

/** Postgres unique 제약 위반(23505) 여부 */
export function isUniqueViolation(err: unknown): boolean {
  let e: unknown = err;
  for (let i = 0; i < 3 && e && typeof e === "object"; i++) {
    if ((e as { code?: string }).code === "23505") return true;
    e = (e as { cause?: unknown }).cause;
  }
  return false;
}
