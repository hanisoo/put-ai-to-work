import CategoryManager from "@/components/CategoryManager";
import ReclassifyButton from "@/components/ReclassifyButton";

export const metadata = { title: "카테고리 관리 · AI 뉴스 수집기" };

export default function CategoriesPage() {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold">카테고리 관리</h1>
          <p className="mt-1 text-sm text-slate-500">
            카테고리를 바꿔도 기존 뉴스는 그대로입니다. &apos;재분류&apos;를 누르면 현재 카테고리 기준으로 다시 분류합니다.
          </p>
        </div>
        <ReclassifyButton />
      </div>
      <CategoryManager />
    </div>
  );
}
