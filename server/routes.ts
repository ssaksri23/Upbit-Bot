import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { UpbitService } from "./upbit";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Initialize default settings
  await storage.initializeSettings();

  // Instantiate Upbit Service (simulated if no keys)
  const upbitService = new UpbitService(storage);
  upbitService.startLoop(); // Start the background monitoring loop

  // API Routes
  app.get(api.upbit.status.path, async (req, res) => {
    const status = await upbitService.getStatus();
    res.json(status);
  });

  app.get(api.upbit.settings.get.path, async (req, res) => {
    const settings = await storage.getBotSettings();
    if (!settings) return res.status(404).send("Settings not found");
    res.json({
      isActive: settings.isActive,
      market: settings.market,
      buyThreshold: settings.buyThreshold,
      sellThreshold: settings.sellThreshold,
      targetAmount: settings.targetAmount
    });
  });

  app.post(api.upbit.settings.update.path, async (req, res) => {
    const updates = req.body;
    await storage.updateBotSettings(updates);
    res.json({ success: true });
  });

  app.post(api.upbit.toggle.path, async (req, res) => {
    const { isActive } = req.body;
    await storage.updateBotSettings({ isActive });
    res.json({ success: true, isActive });
  });

  app.get(api.logs.list.path, async (req, res) => {
    const logs = await storage.getTradeLogs();
    res.json(logs);
  });

  return httpServer;
}
