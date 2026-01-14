import { 
  users, surveyCases, surveyors, systemSettings, surveyorLeaves,
  type User, type InsertUser,
  type SurveyCase, type InsertSurveyCase, type UpdateSurveyCase,
  type Surveyor, type InsertSurveyor, type UpdateSurveyor,
  type SystemSettings, type UpdateSettings,
  type SurveyorLeave, type InsertSurveyorLeave,
  type CoordinateStatus
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, and, gte, or, ilike } from "drizzle-orm";

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
  updateCaseCoordinates(id: string, longitude: number | null, latitude: number | null, status: CoordinateStatus, source?: string): Promise<SurveyCase | undefined>;

  getAllSurveyors(): Promise<Surveyor[]>;
  getSurveyor(id: string): Promise<Surveyor | undefined>;
  createSurveyor(data: InsertSurveyor): Promise<Surveyor>;
  updateSurveyor(id: string, data: UpdateSurveyor): Promise<Surveyor | undefined>;
  deleteSurveyor(id: string): Promise<boolean>;
  addPointsToSurveyor(id: string, points: number): Promise<Surveyor | undefined>;

  getSettings(): Promise<SystemSettings>;
  updateSettings(data: UpdateSettings): Promise<SystemSettings>;

  getAllLeaves(): Promise<SurveyorLeave[]>;
  getLeavesByDate(date: string): Promise<SurveyorLeave[]>;
  getLeavesBySurveyor(surveyorId: string): Promise<SurveyorLeave[]>;
  createLeave(data: InsertSurveyorLeave): Promise<SurveyorLeave>;
  deleteLeave(id: string): Promise<boolean>;
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
          ilike(surveyCases.landParcel, searchPattern),
          ilike(surveyCases.owner, searchPattern),
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

  async getAllLeaves(): Promise<SurveyorLeave[]> {
    const today = new Date().toISOString().split('T')[0];
    return db.select().from(surveyorLeaves)
      .where(gte(surveyorLeaves.leaveDate, today))
      .orderBy(asc(surveyorLeaves.leaveDate));
  }

  async getLeavesByDate(date: string): Promise<SurveyorLeave[]> {
    return db.select().from(surveyorLeaves)
      .where(eq(surveyorLeaves.leaveDate, date));
  }

  async getLeavesBySurveyor(surveyorId: string): Promise<SurveyorLeave[]> {
    return db.select().from(surveyorLeaves)
      .where(eq(surveyorLeaves.surveyorId, surveyorId))
      .orderBy(asc(surveyorLeaves.leaveDate));
  }

  async createLeave(data: InsertSurveyorLeave): Promise<SurveyorLeave> {
    const [leave] = await db.insert(surveyorLeaves).values(data).returning();
    return leave;
  }

  async deleteLeave(id: string): Promise<boolean> {
    const result = await db.delete(surveyorLeaves).where(eq(surveyorLeaves.id, id)).returning();
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();
