import { pgTable, text, serial, integer, boolean, timestamp, jsonb, numeric, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

// --- Users ---
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique().notNull(),
  password: text("password").notNull(),
  displayName: text("display_name"),
  isAdmin: boolean("is_admin").default(false),
  subscriptionTier: text("subscription_tier").default("free"),
  subscriptionExpiry: timestamp("subscription_expiry"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// --- Announcements ---
export const announcements = pgTable("announcements", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// --- Trade Logs ---
export const tradeLogs = pgTable("trade_logs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(), // Linked to User (String ID)
  market: text("market").notNull(), 
  side: text("side").notNull(), 
  price: numeric("price").notNull(),
  volume: numeric("volume").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
  status: text("status").notNull(), 
  message: text("message"), 
});

// --- Bot Settings ---
export const botSettings = pgTable("bot_settings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull().unique(), // One settings per user (String ID)
  isActive: boolean("is_active").default(false).notNull(),
  market: text("market").default("KRW-BTC").notNull(),
  strategy: text("strategy").default("percent").notNull(), // percent, grid, dca
  buyThreshold: numeric("buy_threshold").default("0.5"),
  sellThreshold: numeric("sell_threshold").default("0.5"),
  targetAmount: numeric("target_amount").default("10000"),
  
  upbitAccessKey: text("upbit_access_key"),
  upbitSecretKey: text("upbit_secret_key"),
  
  // Trading state (persisted for restart recovery)
  referencePrice: numeric("reference_price"),
  lastTradeTime: timestamp("last_trade_time"),
  
  // Stop-loss / Take-profit settings
  stopLossPercent: numeric("stop_loss_percent").default("5"), // -5% 손절
  takeProfitPercent: numeric("take_profit_percent").default("10"), // +10% 익절
  trailingStopEnabled: boolean("trailing_stop_enabled").default(false),
  trailingStopPercent: numeric("trailing_stop_percent").default("2"), // 고점 대비 -2%
  splitSellEnabled: boolean("split_sell_enabled").default(false), // 분할 매도
  splitSellPercents: text("split_sell_percents").default("50,100"), // 50%, 100% 각각 절반씩
  
  // Portfolio settings
  portfolioMarkets: text("portfolio_markets"), // comma-separated markets
  portfolioAllocations: text("portfolio_allocations"), // comma-separated percentages
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTradeLogSchema = createInsertSchema(tradeLogs).omit({ id: true, timestamp: true });
export const insertBotSettingsSchema = createInsertSchema(botSettings).omit({ id: true });
export const insertAnnouncementSchema = createInsertSchema(announcements).omit({ id: true, createdAt: true });

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type TradeLog = typeof tradeLogs.$inferSelect;
export type InsertTradeLog = z.infer<typeof insertTradeLogSchema>;
export type BotSettings = typeof botSettings.$inferSelect;
export type InsertBotSettings = z.infer<typeof insertBotSettingsSchema>;
export type Announcement = typeof announcements.$inferSelect;
export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;
