import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { UpbitService } from "./upbit";
import { setupAuth } from "./replit_integrations/auth";

// Helper to get user ID from Replit Auth claims
function getUserId(req: any): string {
  return req.user?.claims?.sub || "";
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup Auth first
  await setupAuth(app);

  const upbitService = new UpbitService(storage);
  upbitService.startLoop();

  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated() || !req.user?.claims?.sub) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    next();
  };

  app.get(api.upbit.status.path, requireAuth, async (req, res) => {
    const userId = getUserId(req);
    const status = await upbitService.getStatus(userId);
    res.json(status);
  });

  app.get(api.upbit.settings.get.path, requireAuth, async (req, res) => {
    const userId = getUserId(req);
    const settings = await storage.getBotSettings(userId);
    if (!settings) {
       return res.json({
         isActive: false,
         market: "KRW-BTC",
         buyThreshold: "0.5",
         sellThreshold: "0.5",
         targetAmount: "10000",
         hasAccessKey: false,
         hasSecretKey: false,
       });
    }
    res.json({
      isActive: settings.isActive,
      market: settings.market,
      buyThreshold: settings.buyThreshold,
      sellThreshold: settings.sellThreshold,
      targetAmount: settings.targetAmount,
      hasAccessKey: !!settings.upbitAccessKey,
      hasSecretKey: !!settings.upbitSecretKey,
    });
  });

  app.post(api.upbit.settings.update.path, requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Invalid user session" });
      }
      const updates = req.body;
      await storage.updateBotSettings(userId, updates);
      res.json({ success: true });
    } catch (err) {
      console.error("Failed to update settings:", err);
      res.status(500).json({ message: "Failed to save settings" });
    }
  });

  app.get(api.logs.list.path, requireAuth, async (req, res) => {
    const userId = getUserId(req);
    const logs = await storage.getTradeLogs(userId);
    res.json(logs);
  });
  
  // Replit Auth User endpoint
  app.get(api.auth.me.path, (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.json(null);
    }
    const user = req.user as any;
    const claims = user.claims || {};
    res.json({
      id: claims.sub || "",
      username: claims.email || claims.sub || "User",
      displayName: claims.first_name || claims.email || "User"
    });
  });

  app.post(api.auth.logout.path, (req, res) => {
    req.logout((err) => {
      if (err) return res.status(500).json({ success: false });
      res.json({ success: true });
    });
  });

  return httpServer;
}
