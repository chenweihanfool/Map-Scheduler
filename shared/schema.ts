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

// 法院案件（法院、法院指界）：申請人欄位改填法院名稱，並多股別、發文字號
export const COURT_CASE_TYPES = ["法院", "法院指界"] as const;
export const COURT_NAMES = ["苗栗地方法院", "臺灣高等法院臺中分院"] as const;
export const isCourtCase = (caseType?: string | null) => (COURT_CASE_TYPES as readonly string[]).includes(caseType ?? "");

// Business attribute options (業務屬性)
export const BUSINESS_ATTRIBUTES = [
  "複丈組",
  "政策組", 
  "重測組",
  "課長", // 不參與排件（自動排件、智慧推薦都不會選到）
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
  "建物保存",
  "分割",
  "合併",
  "新登錄",
  "勘查",
  "其他",
] as const;

export const CASE_TYPES = DEFAULT_CASE_TYPES;

// 舊的種類名稱統一：建物、新建 → 建物保存（啟動時轉換，見 server/schema-upgrade.ts）
export const CASE_TYPE_ALIASES: Record<string, string> = { "建物": "建物保存", "新建": "建物保存" };

// Receive word options (收件字)：輸入前兩碼（例 81）即可帶出完整字號
export const RECEIVE_WORDS = [
  "80通數土",
  "81通圖土",
  "82通建",
] as const;

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
  receiveDate: text("receive_date"), // 收件日期 (YYYY-MM-DD format)
  receiveWord: text("receive_word"), // 收件字，例 81通圖土
  caseNumber: text("case_number").notNull(), // 案號
  caseType: text("case_type").notNull().default("鑑界"), // 案件類型
  landParcel: text("land_parcel").notNull(), // 地段地號
  owner: text("owner"), // 申請人；法院案件存法院名稱
  courtDivision: text("court_division"), // 法院案件：股別，例 民信
  courtDocNo: text("court_doc_no"), // 法院案件：發文字號，例 674
  // 延期（比照測量案件排程）：原案件 status=延期 留在原日期作紀錄；有延期日期時另建一筆新案件，兩筆互相連結
  status: text("status"), // 目前只有「延期」；空白為一般案件
  postponeReason: text("postpone_reason"), // 延期理由
  postponedToId: text("postponed_to_id"), // 延期後的新案件
  postponedToDate: text("postponed_to_date"),
  postponedToTime: text("postponed_to_time"),
  postponedFromId: text("postponed_from_id"), // 由哪一件延期而來
  postponedFromDate: text("postponed_from_date"),
  postponedFromTime: text("postponed_from_time"),
  // 連件（比照測量案件排程）：子件只記自己的案號、類型、地段地號，其餘欄位與主件共用；排件量、積分算 1 件，座標只查主件
  subs: jsonb("subs").$type<SubCase[]>(),
  agent: text("agent"), // 代理人（選填）
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

export const subCaseSchema = z.object({
  caseNumber: z.string().default(""),
  caseType: z.string().default(""),
  landParcel: z.string().default(""),
});
export type SubCase = z.infer<typeof subCaseSchema>;
export const subsOf = (c: { subs?: SubCase[] | null }) => (c.subs ?? []).filter((x) => x && (x.caseNumber || x.landParcel));

export const insertSurveyCaseSchema = createInsertSchema(surveyCases).omit({
  id: true,
  createdAt: true,
  coordinateStatus: true,
  coordinateSource: true,
}).extend({
  subs: z.array(subCaseSchema).nullable().optional(),
});

export const updateSurveyCaseSchema = insertSurveyCaseSchema.partial();

export const POSTPONED = "延期";
// 延期前後的案件互相連動的欄位（日期、時間、延期狀態與理由各自獨立）
export const POSTPONE_SYNC_FIELDS = [
  "receiveDate", "receiveWord", "caseNumber", "caseType", "landParcel", "owner", "courtDivision", "courtDocNo",
  "agent", "surveyor", "notes", "subs",
] as const;
export const POSTPONE_REASONS = ["當日下雨", "案情複雜需擴大檢測", "現場會勘時間過長"] as const;
// 延期的原案件只是紀錄，不佔時段、不算排件量
export const isPostponed = (c: { status?: string | null }) => c.status === POSTPONED;
// 延期了但還沒排新日期
export const isPostponePending = (c: { status?: string | null; postponedToId?: string | null }) => c.status === POSTPONED && !c.postponedToId;
export const postponeSchema = z.object({
  reason: z.string().max(100).optional().default(""),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  time: z.string().optional().default(""),
});

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
  color: text("color"), // 代表顏色（SURVEYOR_COLORS）；空白時依排序自動配色
  createdAt: timestamp("created_at").defaultNow(),
});

// 測量員代表顏色可選的顏色（樣式見 client/src/lib/surveyor-colors.ts）
export const SURVEYOR_COLORS = ["blue", "green", "purple", "orange", "pink", "teal", "amber", "indigo", "rose", "cyan", "lime", "red", "sky", "fuchsia", "yellow", "slate"] as const;
export type SurveyorColor = (typeof SURVEYOR_COLORS)[number];

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
  leaveType: text("leave_type").notNull().default("休假"), // 休假／出差／上課
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

// 請假類型（比照「測量案件排程」）：休假、出差、上課，月曆以不同顏色標示
export const LEAVE_TYPES = ["休假", "出差", "上課"] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];
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

// Agents table (代理人資訊)：代理人通訊錄，系統設定裡維護；新增案件時可直接選
export const agents = pgTable("agents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(), // 代理人
  tel: text("tel"), // 電話
  fax: text("fax"), // 傳真
  mobile: text("mobile"), // 手機
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAgentSchema = createInsertSchema(agents).omit({
  id: true,
  createdAt: true,
});

export const updateAgentSchema = insertAgentSchema.partial();

export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type Agent = typeof agents.$inferSelect;

// 工作日調整（月曆「調整工作日」）：kind = off（平日改休假）或 work（假日改上班／補班）
export const workdayOverrides = pgTable("workday_overrides", {
  date: text("date").primaryKey(), // YYYY-MM-DD
  kind: text("kind").notNull(), // off | work
  label: text("label"), // 說明，例 颱風假、補班
  createdAt: timestamp("created_at").defaultNow(),
});
export const workdayOverrideSchema = z.object({
  kind: z.enum(["off", "work"]),
  label: z.string().max(30).nullable().optional(),
});
export type WorkdayOverride = typeof workdayOverrides.$inferSelect;
