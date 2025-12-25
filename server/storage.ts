import { 
  users, surveyCases,
  type User, type InsertUser,
  type SurveyCase, type InsertSurveyCase, type UpdateSurveyCase
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getAllCases(): Promise<SurveyCase[]>;
  getCase(id: string): Promise<SurveyCase | undefined>;
  createCase(data: InsertSurveyCase): Promise<SurveyCase>;
  updateCase(id: string, data: UpdateSurveyCase): Promise<SurveyCase | undefined>;
  deleteCase(id: string): Promise<boolean>;
  updateCaseCoordinates(id: string, longitude: number | null, latitude: number | null, status: string, source?: string): Promise<SurveyCase | undefined>;
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
    status: string,
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
}

export const storage = new DatabaseStorage();
