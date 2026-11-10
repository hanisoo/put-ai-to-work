import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const DEFAULT_CATEGORIES = [
  { name: "모델/연구", description: "새 AI 모델 발표, 벤치마크, 논문, 연구 성과" },
  { name: "제품/서비스", description: "AI 제품·기능 출시, 서비스 업데이트, 앱과 도구" },
  { name: "투자/비즈니스", description: "투자 유치, 인수합병, 실적, 기업 전략, 파트너십" },
  { name: "정책/규제", description: "법률, 규제, 정부 정책, 소송, 안전·윤리 이슈" },
  { name: "기타", description: "위 카테고리에 해당하지 않는 AI 관련 소식" },
];

async function main() {
  // dotenv 로딩 후에 DB 모듈을 불러와야 DATABASE_URL이 설정된다.
  const { db } = await import("./index");
  const { categories } = await import("./schema");

  const inserted = await db
    .insert(categories)
    .values(DEFAULT_CATEGORIES)
    .onConflictDoNothing({ target: categories.name })
    .returning({ name: categories.name });

  console.log(`기본 카테고리 ${inserted.length}개 추가 (이미 있는 항목은 건너뜀)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
