import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { UpbitService } from "./upbit";
import bcrypt from "bcrypt";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

function getUserId(req: any): string {
  return req.session?.userId || "";
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const PgSession = connectPgSimple(session);
  
  app.use(
    session({
      store: new PgSession({
        conString: process.env.DATABASE_URL,
        createTableIfMissing: false,
      }),
      secret: process.env.SESSION_SECRET!,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    })
  );

  const upbitService = new UpbitService(storage);
  upbitService.startLoop();

  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    next();
  };

  app.post(api.auth.register.path, async (req, res) => {
    try {
      const parsed = api.auth.register.input.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "올바른 이메일과 비밀번호를 입력하세요" });
      }
      const { email, password, displayName } = parsed.data;
      
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "이메일이 이미 사용 중입니다" });
      }
      
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.createUser(email, hashedPassword, displayName);
      
      req.session.userId = user.id;
      res.json({ success: true });
    } catch (err) {
      console.error("Registration error:", err);
      res.status(500).json({ message: "회원가입 중 오류가 발생했습니다" });
    }
  });

  app.post(api.auth.login.path, async (req, res) => {
    try {
      const parsed = api.auth.login.input.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "올바른 이메일과 비밀번호를 입력하세요" });
      }
      const { email, password } = parsed.data;
      
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "이메일 또는 비밀번호가 올바르지 않습니다" });
      }
      
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "이메일 또는 비밀번호가 올바르지 않습니다" });
      }
      
      req.session.userId = user.id;
      res.json({ success: true });
    } catch (err) {
      console.error("Login error:", err);
      res.status(500).json({ message: "로그인 중 오류가 발생했습니다" });
    }
  });

  app.get(api.auth.me.path, async (req, res) => {
    if (!req.session?.userId) {
      return res.json(null);
    }
    const user = await storage.getUserById(req.session.userId);
    if (!user) {
      return res.json(null);
    }
    res.json({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    });
  });

  app.post(api.auth.logout.path, (req, res) => {
    req.session.destroy((err) => {
      if (err) return res.status(500).json({ success: false });
      res.json({ success: true });
    });
  });

  app.get(api.upbit.markets.path, async (req, res) => {
    const markets = await upbitService.getMarkets();
    res.json(markets);
  });

  app.get(api.upbit.candles.path, async (req, res) => {
    const market = (req.query.market as string) || "KRW-BTC";
    const count = parseInt(req.query.count as string) || 60;
    const candles = await upbitService.getCandles(market, Math.min(count, 200));
    res.json(candles);
  });

  app.get(api.upbit.recommendations.path, async (req, res) => {
    const recommendations = await upbitService.getRecommendations();
    res.json(recommendations);
  });

  app.get(api.upbit.status.path, requireAuth, async (req, res) => {
    const userId = getUserId(req);
    const marketOverride = req.query.market as string | undefined;
    const status = await upbitService.getStatus(userId, marketOverride);
    res.json(status);
  });

  app.get(api.upbit.settings.get.path, requireAuth, async (req, res) => {
    const userId = getUserId(req);
    const settings = await storage.getBotSettings(userId);
    if (!settings) {
       return res.json({
         isActive: false,
         market: "KRW-BTC",
         strategy: "percent",
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
      strategy: settings.strategy || "percent",
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
      const updates = { ...req.body };
      
      // Validate strategy if provided
      const validStrategies = ["percent", "grid", "dca"];
      if (updates.strategy && !validStrategies.includes(updates.strategy)) {
        return res.status(400).json({ message: "Invalid strategy value" });
      }
      
      // Validate and normalize numeric fields
      if (updates.buyThreshold !== undefined) {
        const val = parseFloat(updates.buyThreshold);
        if (isNaN(val) || val < 0 || val > 100) {
          return res.status(400).json({ message: "Invalid buyThreshold value" });
        }
        updates.buyThreshold = String(val);
      }
      if (updates.sellThreshold !== undefined) {
        const val = parseFloat(updates.sellThreshold);
        if (isNaN(val) || val < 0 || val > 100) {
          return res.status(400).json({ message: "Invalid sellThreshold value" });
        }
        updates.sellThreshold = String(val);
      }
      if (updates.targetAmount !== undefined) {
        const val = parseFloat(updates.targetAmount);
        if (isNaN(val) || val < 0) {
          return res.status(400).json({ message: "Invalid targetAmount value" });
        }
        updates.targetAmount = String(val);
      }
      
      await storage.updateBotSettings(userId, updates);
      res.json({ success: true });
    } catch (err) {
      console.error("Failed to update settings:", err);
      res.status(500).json({ message: "Failed to save settings" });
    }
  });

  app.post(api.upbit.settings.verify.path, requireAuth, async (req, res) => {
    const userId = getUserId(req);
    const settings = await storage.getBotSettings(userId);
    
    if (!settings?.upbitAccessKey || !settings?.upbitSecretKey) {
      return res.json({ success: false, message: "API 키가 설정되지 않았습니다" });
    }
    
    const result = await upbitService.verifyApiKeys(settings.upbitAccessKey, settings.upbitSecretKey);
    res.json(result);
  });

  // Manual Buy
  app.post(api.upbit.trade.buy.path, requireAuth, async (req, res) => {
    const userId = getUserId(req);
    const settings = await storage.getBotSettings(userId);
    
    if (!settings?.upbitAccessKey || !settings?.upbitSecretKey) {
      return res.json({ success: false, message: "API 키가 설정되지 않았습니다" });
    }

    const { market, amount } = req.body;
    if (!market || !amount || amount < 5000) {
      return res.json({ success: false, message: "최소 주문 금액은 5,000원입니다" });
    }

    const currentPrice = await upbitService.getCurrentPrice(market);
    const result = await upbitService.placeBuyOrder(
      settings.upbitAccessKey,
      settings.upbitSecretKey,
      market,
      amount
    );

    await storage.createTradeLog({
      userId,
      market,
      side: "bid",
      price: String(currentPrice),
      volume: String(amount / currentPrice),
      status: result.success ? "success" : "failed",
      message: result.success ? `수동 매수: ${amount.toLocaleString()}원` : result.message,
    });

    res.json({ 
      success: result.success, 
      message: result.success ? `${amount.toLocaleString()}원 매수 완료` : (result.message || "매수 실패") 
    });
  });

  // Manual Sell (sell all)
  app.post(api.upbit.trade.sell.path, requireAuth, async (req, res) => {
    const userId = getUserId(req);
    const settings = await storage.getBotSettings(userId);
    
    if (!settings?.upbitAccessKey || !settings?.upbitSecretKey) {
      return res.json({ success: false, message: "API 키가 설정되지 않았습니다" });
    }

    const { market } = req.body;
    if (!market) {
      return res.json({ success: false, message: "마켓을 선택하세요" });
    }

    const coinSymbol = market.split("-")[1];
    const coinBalance = await upbitService.getAccountBalance(settings.upbitAccessKey, settings.upbitSecretKey, coinSymbol);
    const currentPrice = await upbitService.getCurrentPrice(market);

    if (coinBalance * currentPrice < 5000) {
      return res.json({ success: false, message: "매도 가능한 수량이 부족합니다 (최소 5,000원)" });
    }

    const result = await upbitService.placeSellOrder(
      settings.upbitAccessKey,
      settings.upbitSecretKey,
      market,
      coinBalance
    );

    await storage.createTradeLog({
      userId,
      market,
      side: "ask",
      price: String(currentPrice),
      volume: String(coinBalance),
      status: result.success ? "success" : "failed",
      message: result.success ? `수동 매도: ${coinBalance.toFixed(8)} ${coinSymbol}` : result.message,
    });

    res.json({ 
      success: result.success, 
      message: result.success ? `${coinBalance.toFixed(8)} ${coinSymbol} 매도 완료` : (result.message || "매도 실패") 
    });
  });

  app.get(api.logs.list.path, requireAuth, async (req, res) => {
    const userId = getUserId(req);
    const logs = await storage.getTradeLogs(userId);
    res.json(logs);
  });

  return httpServer;
}
