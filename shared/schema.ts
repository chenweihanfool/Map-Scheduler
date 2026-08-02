import { sql } from "drizzle-orm";
import { pgSchema, text, varchar, timestamp, doublePrecision, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// This app's tables live in a dedicated "mapscheduler" schema on the shared
// Azure Postgres instance (not the default "public" schema), since that
// database also hosts other unrelated apps' data. Using pgSchema().table()
// bakes the schema into every generated query explicitly, rather than
// relying on the connection's search_path -- more robust across a
// connection pool where each new connection would otherwise need its own
// SET search_path.
const mapschedulerSchema = pgSchema("mapscheduler");
const pgTable = mapschedulerSchema.table;

// Business attribute options (業務屬性)
export const BUSINESS_ATTRIBUTES = [
  "複丈組",
  "政策組", 
  "重測組",
  "其他",
] as const;

export type BusinessAttribute = typeof BUSINESS_ATTRIBUTES[number];

// Assignment mode options (排件模式)
export const ASSIGNMENT_MODES = [
  "sequential", // 順序模式
  "points",     // 積分模式
] as const;

export type AssignmentMode = typeof ASSIGNMENT_MODES[number];

// Default case type options (案件類型) - used as fallback
export const DEFAULT_CASE_TYPES = [
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

export const CASE_TYPES = DEFAULT_CASE_TYPES;

export type CaseType = string;

// Coordinate status options (座標狀態)
export const COORDINATE_STATUSES = [
  "pending",     // 等待查詢
  "processing",  // 查詢中
  "success",     // 查詢成功
  "failed",      // 查詢失敗
  "not_found",   // 座標不存在（案件仍可儲存）
] as const;

export type CoordinateStatus = typeof COORDINATE_STATUSES[number];

// Survey Case table for scheduling land survey appointments
//
// Note: the actual database table also has a `geom` column
// (geometry(Point, 3826) via PostGIS, TWD97/TM2 projection of
// longitude/latitude) that is deliberately NOT declared here. It's not read
// or written by this app anywhere -- it exists for external tools (e.g.
// QGIS connecting to the database directly) that expect projected
// coordinates rather than WGS84 lon/lat. It was carried over as-is during
// the 2026-08 migration off Replit specifically so those external
// consumers keep working; don't remove it via drizzle-kit push without
// checking whether anything still depends on it.
export const surveyCases = pgTable("survey_cases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseNumber: text("case_number").notNull(), // 案號
  caseType: text("case_type").notNull().default("鑑界"), // 案件類型
  landParcel: text("land_parcel").notNull(), // 地段地號
  owner: text("owner"), // 所有權人
  surveyor: text("surveyor").notNull(), // 測量員
  surveyDate: text("survey_date").notNull(), // 日期 (YYYY-MM-DD format)
  scheduledTime: text("scheduled_time").notNull(), // 排件時間
  longitude: doublePrecision("longitude"), // 經度
  latitude: doublePrecision("latitude"), // 緯度
  coordinateStatus: text("coordinate_status").default("pending"), // pending, processing, success, failed, not_found
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

// Surveyors table (測量員)
export const surveyors = pgTable("surveyors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  businessAttribute: text("business_attribute").notNull().default("複丈組"), // 業務屬性
  points: integer("points").notNull().default(0), // 積分
  sortOrder: integer("sort_order").notNull().default(0), // 排序順序
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSurveyorSchema = createInsertSchema(surveyors).omit({
  id: true,
  createdAt: true,
});

export const updateSurveyorSchema = insertSurveyorSchema.partial();

export type InsertSurveyor = z.infer<typeof insertSurveyorSchema>;
export type UpdateSurveyor = z.infer<typeof updateSurveyorSchema>;
export type Surveyor = typeof surveyors.$inferSelect;

// System settings table (系統設定)
export const systemSettings = pgTable("system_settings", {
  id: varchar("id").primaryKey().default("default"),
  assignmentMode: text("assignment_mode").notNull().default("sequential"), // sequential or points
  caseTypeWeights: jsonb("case_type_weights").$type<Record<string, number>>().default({}), // 案件類型權重
  lastAssignedSurveyorId: varchar("last_assigned_surveyor_id"), // 上次指派的測量員 (順序模式用)
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const updateSettingsSchema = z.object({
  assignmentMode: z.enum(ASSIGNMENT_MODES).optional(),
  caseTypeWeights: z.record(z.string(), z.number()).optional(),
  lastAssignedSurveyorId: z.string().nullable().optional(),
});

export type UpdateSettings = z.infer<typeof updateSettingsSchema>;
export type SystemSettings = typeof systemSettings.$inferSelect;

// Surveyor leaves table (測量員請假)
export const surveyorLeaves = pgTable("surveyor_leaves", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  surveyorId: varchar("surveyor_id").notNull().references(() => surveyors.id, { onDelete: "cascade" }),
  surveyorName: text("surveyor_name").notNull(), // 備份名稱方便查詢
  startDatetime: text("start_datetime").notNull(), // 請假開始時間 (YYYY-MM-DD HH:MM format)
  endDatetime: text("end_datetime").notNull(),     // 請假結束時間 (YYYY-MM-DD HH:MM format)
  reason: text("reason"), // 請假原因
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSurveyorLeaveSchema = createInsertSchema(surveyorLeaves).omit({
  id: true,
  createdAt: true,
});

export type InsertSurveyorLeave = z.infer<typeof insertSurveyorLeaveSchema>;
export type SurveyorLeave = typeof surveyorLeaves.$inferSelect;

// Custom case types table (自訂案件類型)
export const caseTypes = pgTable("case_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCaseTypeSchema = createInsertSchema(caseTypes).omit({
  id: true,
  createdAt: true,
});

export type InsertCaseType = z.infer<typeof insertCaseTypeSchema>;
export type CaseTypeRecord = typeof caseTypes.$inferSelect;
