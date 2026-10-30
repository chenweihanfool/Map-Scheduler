import { 
  users, surveyCases, surveyors, systemSettings, surveyorLeaves, caseTypes,
  type User, type InsertUser,
  type SurveyCase, type InsertSurveyCase, type UpdateSurveyCase,
  type Surveyor, type InsertSurveyor, type UpdateSurveyor,
  type SystemSettings, type UpdateSettings,
  type SurveyorLeave, type InsertSurveyorLeave,
  type CoordinateStatus,
  type CaseTypeRecord, type InsertCaseType,
  type Agent, type InsertAgent, agents,
  DEFAULT_CASE_TYPES,
  POSTPONED,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, and, gte, lte, or, ilike, sql } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getAllCases(): Promise<SurveyCase[]>;
  searchCases(query: string): Promise<SurveyCase[]>;
  getCase(id: string): Promise<SurveyCase | undefined>;
  createCase(data: InsertSurveyCase): Promise<SurveyCase>;
  updateCase(id: string, data: UpdateSurveyCase): Promise<SurveyCase | undefined>;
  deleteCase(id: string): Promise<boolean>;
  postponeCase(id: string, reason: string, date?: string, time?: string): Promise<{ original: SurveyCase; copy?: SurveyCase }>;
  cancelPostpone(id: string): Promise<SurveyCase | undefined>;
  updateCaseCoordinates(id: string, longitude: number | null, latitude: number | null, status: CoordinateStatus, source?: string): Promise<SurveyCase | undefined>;

  getAllSurveyors(): Promise<Surveyor[]>;
  getSurveyor(id: string): Promise<Surveyor | undefined>;
  createSurveyor(data: InsertSurveyor): Promise<Surveyor>;
  updateSurveyor(id: string, data: UpdateSurveyor): Promise<Surveyor | undefined>;
  deleteSurveyor(id: string): Promise<boolean>;
  reorderSurveyors(ids: string[]): Promise<void>;
  addPointsToSurveyor(id: string, points: number): Promise<Surveyor | undefined>;

  getSettings(): Promise<SystemSettings>;
  updateSettings(data: UpdateSettings): Promise<SystemSettings>;

  getAllLeaves(includePast?: boolean): Promise<SurveyorLeave[]>;
  getLeave(id: string): Promise<SurveyorLeave | undefined>;
  getLeavesByDate(date: string): Promise<SurveyorLeave[]>;
  getLeavesBySurveyor(surveyorId: string): Promise<SurveyorLeave[]>;
  createLeave(data: InsertSurveyorLeave): Promise<SurveyorLeave>;
  updateLeave(id: string, data: Partial<InsertSurveyorLeave>): Promise<SurveyorLeave | undefined>;
  deleteLeave(id: string): Promise<boolean>;

  getAllCaseTypes(): Promise<CaseTypeRecord[]>;
  createCaseType(data: InsertCaseType): Promise<CaseTypeRecord>;
  updateCaseType(id: string, data: Partial<InsertCaseType>): Promise<CaseTypeRecord | undefined>;
  deleteCaseType(id: string): Promise<boolean>;
  reorderCaseTypes(ids: string[]): Promise<void>;
  initializeDefaultCaseTypes(): Promise<void>;
  getAllAgents(): Promise<Agent[]>;
  createAgent(data: InsertAgent): Promise<Agent>;
  updateAgent(id: string, data: Partial<InsertAgent>): Promise<Agent | undefined>;
  deleteAgent(id: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getAllCases(): Promise<SurveyCase[]> {
    return db.select().from(surveyCases).orderBy(desc(surveyCases.createdAt));
  }

  async searchCases(query: string): Promise<SurveyCase[]> {
    const searchPattern = `%${query}%`;
    return db.select().from(surveyCases)
      .where(
        or(
          ilike(surveyCases.caseNumber, searchPattern),
          ilike(surveyCases.receiveWord, searchPattern),
          ilike(surveyCases.landParcel, searchPattern),
          ilike(surveyCases.owner, searchPattern),
          ilike(surveyCases.courtDivision, searchPattern),
          ilike(surveyCases.courtDocNo, searchPattern),
          sql`${surveyCases.subs}::text ilike ${searchPattern}`,
          ilike(surveyCases.agent, searchPattern),
          ilike(surveyCases.surveyor, searchPattern)
        )
      )
      .orderBy(desc(surveyCases.createdAt));
  }

  async getCase(id: string): Promise<SurveyCase | undefined> {
    const [surveyCase] = await db.select().from(surveyCases).where(eq(surveyCases.id, id));
    return surveyCase || undefined;
  }

  async createCase(data: InsertSurveyCase): Promise<SurveyCase> {
    const [surveyCase] = await db.insert(surveyCases).values({
      ...data,
      coordinateStatus: "pending",
    }).returning();
    return surveyCase;
  }

  async updateCase(id: string, data: UpdateSurveyCase): Promise<SurveyCase | undefined> {
    const [surveyCase] = await db
      .update(surveyCases)
      .set(data)
      .where(eq(surveyCases.id, id))
      .returning();
    return surveyCase || undefined;
  }

  // 延期：原案件標「延期」留在原日期；有延期日期時，複製一筆到新日期（座標一起複製），兩筆互相連結
  async postponeCase(id: string, reason: string, date?: string, time?: string): Promise<{ original: SurveyCase; copy?: SurveyCase }> {
    return db.transaction(async (tx) => {
      const [orig] = await tx.select().from(surveyCases).where(eq(surveyCases.id, id));
      if (!orig) throw Object.assign(new Error("Case not found"), { status: 404 });
      if (orig.postponedToId) throw Object.assign(new Error("這件已經延期到其他日期"), { status: 409 });
      const reasonValue = reason.trim() || orig.postponeReason || null;
      if (!date) {
        const [original] = await tx.update(surveyCases).set({ status: POSTPONED, postponeReason: reasonValue }).where(eq(surveyCases.id, id)).returning();
        return { original };
      }
      const { id: _id, createdAt: _c, ...rest } = orig;
      const [copy] = await tx.insert(surveyCases).values({
        ...rest,
        surveyDate: date,
        scheduledTime: time || orig.scheduledTime,
        status: null,
        postponeReason: null,
        postponedToId: null,
        postponedToDate: null,
        postponedToTime: null,
        postponedFromId: orig.id,
        postponedFromDate: orig.surveyDate,
        postponedFromTime: orig.scheduledTime,
      }).returning();
      const [original] = await tx.update(surveyCases).set({
        status: POSTPONED,
        postponeReason: reasonValue,
        postponedToId: copy.id,
        postponedToDate: copy.surveyDate,
        postponedToTime: copy.scheduledTime,
      }).where(eq(surveyCases.id, id)).returning();
      return { original, copy };
    });
  }

  // 取消延期：只限還沒排新日期的
  async cancelPostpone(id: string): Promise<SurveyCase | undefined> {
    const [c] = await db.select().from(surveyCases).where(eq(surveyCases.id, id));
    if (!c) return undefined;
    if (c.postponedToId) throw Object.assign(new Error("已延期到其他日期的案件不能取消延期"), { status: 409 });
    const [updated] = await db.update(surveyCases).set({ status: null, postponeReason: null }).where(eq(surveyCases.id, id)).returning();
    return updated;
  }

  async deleteCase(id: string): Promise<boolean> {
    const result = await db.delete(surveyCases).where(eq(surveyCases.id, id)).returning();
    return result.length > 0;
  }

  async updateCaseCoordinates(
    id: string, 
    longitude: number | null, 
    latitude: number | null, 
    status: CoordinateStatus,
    source?: string
  ): Promise<SurveyCase | undefined> {
    const [surveyCase] = await db
      .update(surveyCases)
      .set({ 
        longitude, 
        latitude, 
        coordinateStatus: status,
        coordinateSource: source || null,
      })
      .where(eq(surveyCases.id, id))
      .returning();
    return surveyCase || undefined;
  }

  async getAllSurveyors(): Promise<Surveyor[]> {
    return db.select().from(surveyors).orderBy(asc(surveyors.sortOrder));
  }

  async reorderSurveyors(ids: string[]): Promise<void> {
    await db.transaction(async (tx) => {
      for (let i = 0; i < ids.length; i++) {
        await tx.update(surveyors).set({ sortOrder: i }).where(eq(surveyors.id, ids[i]));
      }
    });
  }

  async getSurveyor(id: string): Promise<Surveyor | undefined> {
    const [surveyor] = await db.select().from(surveyors).where(eq(surveyors.id, id));
    return surveyor || undefined;
  }

  async createSurveyor(data: InsertSurveyor): Promise<Surveyor> {
    const allSurveyors = await this.getAllSurveyors();
    const maxSortOrder = allSurveyors.length > 0 
      ? Math.max(...allSurveyors.map(s => s.sortOrder)) 
      : -1;
    
    const [surveyor] = await db.insert(surveyors).values({
      ...data,
      sortOrder: data.sortOrder ?? maxSortOrder + 1,
    }).returning();
    return surveyor;
  }

  async updateSurveyor(id: string, data: UpdateSurveyor): Promise<Surveyor | undefined> {
    const [surveyor] = await db
      .update(surveyors)
      .set(data)
      .where(eq(surveyors.id, id))
      .returning();
    return surveyor || undefined;
  }

  async deleteSurveyor(id: string): Promise<boolean> {
    const result = await db.delete(surveyors).where(eq(surveyors.id, id)).returning();
    return result.length > 0;
  }

  async addPointsToSurveyor(id: string, points: number): Promise<Surveyor | undefined> {
    const surveyor = await this.getSurveyor(id);
    if (!surveyor) return undefined;
    
    const [updated] = await db
      .update(surveyors)
      .set({ points: surveyor.points + points })
      .where(eq(surveyors.id, id))
      .returning();
    return updated || undefined;
  }

  async getSettings(): Promise<SystemSettings> {
    const [settings] = await db.select().from(systemSettings).where(eq(systemSettings.id, "default"));
    if (settings) return settings;
    
    const [newSettings] = await db.insert(systemSettings).values({
      id: "default",
      assignmentMode: "sequential",
      caseTypeWeights: {},
    }).returning();
    return newSettings;
  }

  async updateSettings(data: UpdateSettings): Promise<SystemSettings> {
    await this.getSettings();
    
    const [settings] = await db
      .update(systemSettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(systemSettings.id, "default"))
      .returning();
    return settings;
  }

  async getAllLeaves(includePast = false): Promise<SurveyorLeave[]> {
    if (includePast) {
      return db.select().from(surveyorLeaves).orderBy(asc(surveyorLeaves.startDatetime));
    }
    const today = new Date().toISOString().split('T')[0];
    const todayStart = `${today} 00:00`;
    return db.select().from(surveyorLeaves)
      .where(gte(surveyorLeaves.endDatetime, todayStart))
      .orderBy(asc(surveyorLeaves.startDatetime));
  }

  async getLeave(id: string): Promise<SurveyorLeave | undefined> {
    const [leave] = await db.select().from(surveyorLeaves).where(eq(surveyorLeaves.id, id));
    return leave || undefined;
  }

  async getLeavesByDate(date: string): Promise<SurveyorLeave[]> {
    // Returns leaves that overlap with the given date (YYYY-MM-DD)
    const dayStart = `${date} 00:00`;
    const dayEnd = `${date} 23:59`;
    const all = await db.select().from(surveyorLeaves);
    return all.filter(l => l.startDatetime <= dayEnd && l.endDatetime >= dayStart);
  }

  async getLeavesBySurveyor(surveyorId: string): Promise<SurveyorLeave[]> {
    return db.select().from(surveyorLeaves)
      .where(eq(surveyorLeaves.surveyorId, surveyorId))
      .orderBy(asc(surveyorLeaves.startDatetime));
  }

  async createLeave(data: InsertSurveyorLeave): Promise<SurveyorLeave> {
    const [leave] = await db.insert(surveyorLeaves).values(data).returning();
    return leave;
  }

  async updateLeave(id: string, data: Partial<InsertSurveyorLeave>): Promise<SurveyorLeave | undefined> {
    const [leave] = await db
      .update(surveyorLeaves)
      .set(data)
      .where(eq(surveyorLeaves.id, id))
      .returning();
    return leave || undefined;
  }

  async deleteLeave(id: string): Promise<boolean> {
    const result = await db.delete(surveyorLeaves).where(eq(surveyorLeaves.id, id)).returning();
    return result.length > 0;
  }

  async getAllCaseTypes(): Promise<CaseTypeRecord[]> {
    return db.select().from(caseTypes).orderBy(asc(caseTypes.sortOrder));
  }

  async createCaseType(data: InsertCaseType): Promise<CaseTypeRecord> {
    const allTypes = await this.getAllCaseTypes();
    const maxSortOrder = allTypes.length > 0
      ? Math.max(...allTypes.map(t => t.sortOrder))
      : -1;

    const [caseType] = await db.insert(caseTypes).values({
      ...data,
      sortOrder: data.sortOrder ?? maxSortOrder + 1,
    }).returning();
    return caseType;
  }

  async reorderCaseTypes(ids: string[]): Promise<void> {
    await db.transaction(async (tx) => {
      for (let i = 0; i < ids.length; i++) {
        await tx.update(caseTypes).set({ sortOrder: i }).where(eq(caseTypes.id, ids[i]));
      }
    });
  }

  async updateCaseType(id: string, data: Partial<InsertCaseType>): Promise<CaseTypeRecord | undefined> {
    const [caseType] = await db
      .update(caseTypes)
      .set(data)
      .where(eq(caseTypes.id, id))
      .returning();
    return caseType || undefined;
  }

  async deleteCaseType(id: string): Promise<boolean> {
    const result = await db.delete(caseTypes).where(eq(caseTypes.id, id)).returning();
    return result.length > 0;
  }

  async getAllAgents(): Promise<Agent[]> {
    return db.select().from(agents).orderBy(asc(agents.sortOrder), asc(agents.name));
  }

  async createAgent(data: InsertAgent): Promise<Agent> {
    const all = await this.getAllAgents();
    const maxOrder = all.reduce((m, a) => Math.max(m, a.sortOrder), -1);
    const [agent] = await db.insert(agents).values({ ...data, sortOrder: data.sortOrder ?? maxOrder + 1 }).returning();
    return agent;
  }

  async updateAgent(id: string, data: Partial<InsertAgent>): Promise<Agent | undefined> {
    const [agent] = await db.update(agents).set(data).where(eq(agents.id, id)).returning();
    return agent || undefined;
  }

  async deleteAgent(id: string): Promise<boolean> {
    const result = await db.delete(agents).where(eq(agents.id, id)).returning();
    return result.length > 0;
  }

  async initializeDefaultCaseTypes(): Promise<void> {
    const existing = await this.getAllCaseTypes();
    if (existing.length === 0) {
      for (let i = 0; i < DEFAULT_CASE_TYPES.length; i++) {
        await db.insert(caseTypes).values({
          name: DEFAULT_CASE_TYPES[i],
          sortOrder: i,
        }).onConflictDoNothing();
      }
    }
  }
}

export const storage = new DatabaseStorage();
