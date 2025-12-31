import { db } from "./db";
import {
  tradeLogs,
  botSettings,
  type InsertTradeLog,
  type InsertBotSettings,
  type TradeLog,
  type BotSettings
} from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // Logs
  getTradeLogs(): Promise<TradeLog[]>;
  createTradeLog(log: InsertTradeLog): Promise<TradeLog>;

  // Settings
  getBotSettings(): Promise<BotSettings | undefined>;
  updateBotSettings(settings: Partial<InsertBotSettings>): Promise<BotSettings>;
  initializeSettings(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getTradeLogs(): Promise<TradeLog[]> {
    return await db.select().from(tradeLogs).orderBy(desc(tradeLogs.timestamp)).limit(50);
  }

  async createTradeLog(log: InsertTradeLog): Promise<TradeLog> {
    const [newLog] = await db.insert(tradeLogs).values(log).returning();
    return newLog;
  }

  async getBotSettings(): Promise<BotSettings | undefined> {
    const [settings] = await db.select().from(botSettings).limit(1);
    return settings;
  }

  async updateBotSettings(settings: Partial<InsertBotSettings>): Promise<BotSettings> {
    const existing = await this.getBotSettings();
    if (existing) {
      const [updated] = await db
        .update(botSettings)
        .set(settings)
        .where(eq(botSettings.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(botSettings).values({
        isActive: false,
        market: "KRW-BTC",
        ...settings
      } as InsertBotSettings).returning();
      return created;
    }
  }

  async initializeSettings(): Promise<void> {
    const existing = await this.getBotSettings();
    if (!existing) {
      await db.insert(botSettings).values({
        isActive: false,
        market: "KRW-BTC",
        buyThreshold: "0.5",
        sellThreshold: "0.5",
        targetAmount: "10000"
      });
    }
  }
}

export const storage = new DatabaseStorage();
