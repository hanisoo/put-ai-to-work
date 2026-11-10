import {
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const articles = pgTable("articles", {
  id: serial("id").primaryKey(),
  url: text("url").notNull().unique(),
  source: text("source", { enum: ["techcrunch", "theverge"] }).notNull(),
  originalTitle: text("original_title").notNull(),
  titleKo: text("title_ko").notNull(),
  summaryKo: text("summary_ko").notNull(),
  categoryId: integer("category_id").references(() => categories.id, {
    onDelete: "set null",
  }),
  imageUrl: text("image_url"),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notionSaves = pgTable("notion_saves", {
  id: serial("id").primaryKey(),
  articleId: integer("article_id")
    .notNull()
    .references(() => articles.id, { onDelete: "cascade" }),
  notionPageUrl: text("notion_page_url").notNull(),
  savedBy: text("saved_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 앱 전체에서 1건만 유지한다 (id = 1).
export const notionConnection = pgTable("notion_connection", {
  id: integer("id").primaryKey(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  clientId: text("client_id"),
  clientSecret: text("client_secret"),
  parentPageId: text("parent_page_id"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Category = typeof categories.$inferSelect;
export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
export type NotionConnection = typeof notionConnection.$inferSelect;
