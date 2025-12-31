import { pgTable, text, serial, integer, boolean, timestamp, jsonb, numeric, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

// --- Replit Auth Users (Matches shared/models/auth.ts structure) ---
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  username: text("username").unique(),
  displayName: text("display_name"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
  buyThreshold: numeric("buy_threshold").default("0.5"),
  sellThreshold: numeric("sell_threshold").default("0.5"),
  targetAmount: numeric("target_amount").default("10000"),
  
  upbitAccessKey: text("upbit_access_key"),
  upbitSecretKey: text("upbit_secret_key"),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTradeLogSchema = createInsertSchema(tradeLogs).omit({ id: true, timestamp: true });
export const insertBotSettingsSchema = createInsertSchema(botSettings).omit({ id: true });

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type TradeLog = typeof tradeLogs.$inferSelect;
export type InsertTradeLog = z.infer<typeof insertTradeLogSchema>;
export type BotSettings = typeof botSettings.$inferSelect;
export type InsertBotSettings = z.infer<typeof insertBotSettingsSchema>;
