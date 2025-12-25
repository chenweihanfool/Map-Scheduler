import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Case type options (案件類型)
export const CASE_TYPES = [
  "鑑界",
  "再鑑界", 
  "法院",
  "建物",
  "分割",
  "合併",
  "新登錄",
  "勘查",
  "其他",
] as const;

export type CaseType = typeof CASE_TYPES[number];

// Survey Case table for scheduling land survey appointments
export const surveyCases = pgTable("survey_cases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseNumber: text("case_number").notNull(), // 案號
  caseType: text("case_type").notNull().default("鑑界"), // 案件類型
  landParcel: text("land_parcel").notNull(), // 地段地號
  surveyor: text("surveyor").notNull(), // 測量員
  surveyDate: text("survey_date").notNull(), // 日期 (YYYY-MM-DD format)
  scheduledTime: text("scheduled_time").notNull(), // 排件時間
  longitude: doublePrecision("longitude"), // 經度
  latitude: doublePrecision("latitude"), // 緯度
  coordinateStatus: text("coordinate_status").default("pending"), // pending, success, failed, processing
  coordinateSource: text("coordinate_source"), // NLSC or Miaoli GIS
  notes: text("notes"), // 備註
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSurveyCaseSchema = createInsertSchema(surveyCases).omit({
  id: true,
  createdAt: true,
  coordinateStatus: true,
  coordinateSource: true,
});

export const updateSurveyCaseSchema = insertSurveyCaseSchema.partial();

export type InsertSurveyCase = z.infer<typeof insertSurveyCaseSchema>;
export type UpdateSurveyCase = z.infer<typeof updateSurveyCaseSchema>;
export type SurveyCase = typeof surveyCases.$inferSelect;

// Users table (keeping for potential future auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
