import { db } from "./db";
import {
  users, tradeLogs, botSettings,
  type User, type InsertUser,
  type InsertTradeLog, type InsertBotSettings,
  type TradeLog, type BotSettings
} from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // Users (Managed by Replit Auth mostly, but exposed here)
  getUserByUsername(username: string): Promise<User | undefined>;
  
  // Logs
  getTradeLogs(userId: string): Promise<TradeLog[]>;
  createTradeLog(log: InsertTradeLog): Promise<TradeLog>;

  // Settings
  getBotSettings(userId: string): Promise<BotSettings | undefined>;
  updateBotSettings(userId: string, settings: Partial<InsertBotSettings>): Promise<BotSettings>;
  getAllActiveSettings(): Promise<BotSettings[]>; 
}

export class DatabaseStorage implements IStorage {
  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getTradeLogs(userId: string): Promise<TradeLog[]> {
    return await db.select()
      .from(tradeLogs)
      .where(eq(tradeLogs.userId, userId))
      .orderBy(desc(tradeLogs.timestamp))
      .limit(50);
  }

  async createTradeLog(log: InsertTradeLog): Promise<TradeLog> {
    const [newLog] = await db.insert(tradeLogs).values(log).returning();
    return newLog;
  }

  async getBotSettings(userId: string): Promise<BotSettings | undefined> {
    const [settings] = await db.select().from(botSettings).where(eq(botSettings.userId, userId));
    return settings;
  }

  async updateBotSettings(userId: string, settings: Partial<InsertBotSettings>): Promise<BotSettings> {
    const existing = await this.getBotSettings(userId);
    if (existing) {
      const [updated] = await db
        .update(botSettings)
        .set(settings)
        .where(eq(botSettings.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(botSettings).values({
        userId,
        isActive: false,
        market: "KRW-BTC",
        ...settings
      } as InsertBotSettings).returning();
      return created;
    }
  }

  async getAllActiveSettings(): Promise<BotSettings[]> {
    return await db.select().from(botSettings).where(eq(botSettings.isActive, true));
  }
}

export const storage = new DatabaseStorage();
