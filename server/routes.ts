import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { UpbitService } from "./upbit";
import { setupAuth } from "./replit_integrations/auth";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup Auth first
  await setupAuth(app);

  const upbitService = new UpbitService(storage);
  upbitService.startLoop();

  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    next();
  };

  app.get(api.upbit.status.path, requireAuth, async (req, res) => {
    // @ts-ignore
    const status = await upbitService.getStatus(req.user!.id);
    res.json(status);
  });

  app.get(api.upbit.settings.get.path, requireAuth, async (req, res) => {
    // @ts-ignore
    const settings = await storage.getBotSettings(req.user!.id);
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
    const updates = req.body;
    // @ts-ignore
    await storage.updateBotSettings(req.user!.id, updates);
    res.json({ success: true });
  });

  app.get(api.logs.list.path, requireAuth, async (req, res) => {
    // @ts-ignore
    const logs = await storage.getTradeLogs(req.user!.id);
    res.json(logs);
  });
  
  // Replit Auth User endpoint
  app.get(api.auth.me.path, (req, res) => {
    if (!req.isAuthenticated()) {
      return res.json(null);
    }
    const user = req.user as any;
    res.json({
      id: user.id,
      username: user.username || user.email,
      displayName: user.displayName || user.firstName
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
