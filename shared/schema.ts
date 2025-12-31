import { pgTable, text, serial, integer, boolean, timestamp, jsonb, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const tradeLogs = pgTable("trade_logs", {
  id: serial("id").primaryKey(),
  market: text("market").notNull(), // e.g., KRW-BTC
  side: text("side").notNull(), // 'bid' (buy) or 'ask' (sell)
  price: numeric("price").notNull(),
  volume: numeric("volume").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
  status: text("status").notNull(), // 'success', 'failed'
  message: text("message"), // error message or details
});

export const botSettings = pgTable("bot_settings", {
  id: serial("id").primaryKey(),
  isActive: boolean("is_active").default(false).notNull(),
  market: text("market").default("KRW-BTC").notNull(),
  buyThreshold: numeric("buy_threshold").default("0.5"), // Buy if price drops X% (example)
  sellThreshold: numeric("sell_threshold").default("0.5"), // Sell if price rises X% (example)
  targetAmount: numeric("target_amount").default("10000"), // Amount to buy in KRW
});

export const insertTradeLogSchema = createInsertSchema(tradeLogs).omit({ id: true, timestamp: true });
export const insertBotSettingsSchema = createInsertSchema(botSettings).omit({ id: true });

export type TradeLog = typeof tradeLogs.$inferSelect;
export type InsertTradeLog = z.infer<typeof insertTradeLogSchema>;
export type BotSettings = typeof botSettings.$inferSelect;
export type InsertBotSettings = z.infer<typeof insertBotSettingsSchema>;
