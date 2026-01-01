import { db } from "./db";
import {
  users, tradeLogs, botSettings, announcements,
  type User, type InsertUser,
  type InsertTradeLog, type InsertBotSettings,
  type TradeLog, type BotSettings,
  type Announcement, type InsertAnnouncement
} from "@shared/schema";
import { eq, desc, count, sql } from "drizzle-orm";

export interface IStorage {
  // Users
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  createUser(email: string, hashedPassword: string, displayName?: string): Promise<User>;
  
  // Logs
  getTradeLogs(userId: string): Promise<TradeLog[]>;
  createTradeLog(log: InsertTradeLog): Promise<TradeLog>;

  // Settings
  getBotSettings(userId: string): Promise<BotSettings | undefined>;
  updateBotSettings(userId: string, settings: Partial<InsertBotSettings>): Promise<BotSettings>;
  getAllActiveSettings(): Promise<BotSettings[]>; 
  
  // Admin
  getAllUsers(): Promise<User[]>;
  updateUserSubscription(userId: string, tier: string, expiry?: Date): Promise<User>;
  getAdminStats(): Promise<{ totalUsers: number; activeBotsCount: number; totalTrades: number; subscriptionCounts: Record<string, number> }>;
  
  // Announcements
  getAnnouncements(activeOnly?: boolean): Promise<Announcement[]>;
  createAnnouncement(announcement: InsertAnnouncement): Promise<Announcement>;
  updateAnnouncement(id: number, data: Partial<InsertAnnouncement>): Promise<Announcement>;
  deleteAnnouncement(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserById(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async createUser(email: string, hashedPassword: string, displayName?: string): Promise<User> {
    const [user] = await db.insert(users).values({
      email,
      password: hashedPassword,
      displayName: displayName || email.split('@')[0],
    }).returning();
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
    if (!userId) {
      throw new Error("User ID is required to update bot settings");
    }
    
    // Trim whitespace from API keys
    const cleanedSettings = { ...settings };
    if (cleanedSettings.upbitAccessKey) {
      cleanedSettings.upbitAccessKey = cleanedSettings.upbitAccessKey.trim();
    }
    if (cleanedSettings.upbitSecretKey) {
      cleanedSettings.upbitSecretKey = cleanedSettings.upbitSecretKey.trim();
    }
    
    const existing = await this.getBotSettings(userId);
    if (existing) {
      const [updated] = await db
        .update(botSettings)
        .set(cleanedSettings)
        .where(eq(botSettings.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(botSettings).values({
        userId,
        isActive: false,
        market: "KRW-BTC",
        ...cleanedSettings
      } as InsertBotSettings).returning();
      return created;
    }
  }

  async getAllActiveSettings(): Promise<BotSettings[]> {
    return await db.select().from(botSettings).where(eq(botSettings.isActive, true));
  }

  // Admin methods
  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async updateUserSubscription(userId: string, tier: string, expiry?: Date): Promise<User> {
    const [updated] = await db
      .update(users)
      .set({ subscriptionTier: tier, subscriptionExpiry: expiry })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async getAdminStats(): Promise<{ totalUsers: number; activeBotsCount: number; totalTrades: number; subscriptionCounts: Record<string, number> }> {
    const allUsers = await db.select().from(users);
    const activeBots = await db.select().from(botSettings).where(eq(botSettings.isActive, true));
    const trades = await db.select({ count: count() }).from(tradeLogs);
    
    const subscriptionCounts: Record<string, number> = { free: 0, pro: 0, premium: 0 };
    allUsers.forEach(user => {
      const tier = user.subscriptionTier || 'free';
      subscriptionCounts[tier] = (subscriptionCounts[tier] || 0) + 1;
    });

    return {
      totalUsers: allUsers.length,
      activeBotsCount: activeBots.length,
      totalTrades: trades[0]?.count || 0,
      subscriptionCounts
    };
  }

  // Announcement methods
  async getAnnouncements(activeOnly = false): Promise<Announcement[]> {
    if (activeOnly) {
      return await db.select().from(announcements).where(eq(announcements.isActive, true)).orderBy(desc(announcements.createdAt));
    }
    return await db.select().from(announcements).orderBy(desc(announcements.createdAt));
  }

  async createAnnouncement(announcement: InsertAnnouncement): Promise<Announcement> {
    const [created] = await db.insert(announcements).values(announcement).returning();
    return created;
  }

  async updateAnnouncement(id: number, data: Partial<InsertAnnouncement>): Promise<Announcement> {
    const [updated] = await db.update(announcements).set(data).where(eq(announcements.id, id)).returning();
    return updated;
  }

  async deleteAnnouncement(id: number): Promise<void> {
    await db.delete(announcements).where(eq(announcements.id, id));
  }
}

export const storage = new DatabaseStorage();
