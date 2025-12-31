import axios from "axios";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import querystring from "querystring";
import { IStorage } from "./storage";
import { BotSettings } from "@shared/schema";

export class UpbitService {
  private storage: IStorage;
  private baseUrl = "https://api.upbit.com/v1";
  private isRunning = false;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  private getAuthToken(accessKey: string, secretKey: string, query?: string) {
    const payload: any = {
      access_key: accessKey,
      nonce: uuidv4(),
    };

    if (query) {
      const hash = crypto.createHash("sha512");
      const queryHash = hash.update(query, "utf-8").digest("hex");
      payload.query_hash = queryHash;
      payload.query_hash_alg = "SHA512";
    }

    return jwt.sign(payload, secretKey, { algorithm: 'HS256' });
  }

  async getMarkets(): Promise<{ market: string; korean_name: string; english_name: string }[]> {
    try {
      const res = await axios.get(`${this.baseUrl}/market/all?isDetails=false`);
      return res.data
        .filter((m: any) => m.market.startsWith("KRW-"))
        .map((m: any) => ({
          market: m.market,
          korean_name: m.korean_name,
          english_name: m.english_name,
        }));
    } catch (e) {
      console.error("Failed to fetch markets:", e);
      return [];
    }
  }

  async getCurrentPrice(market: string): Promise<number> {
    try {
      const res = await axios.get(`${this.baseUrl}/ticker?markets=${market}`);
      return res.data[0].trade_price;
    } catch (e) {
      console.error(`Failed to fetch price for ${market}:`, e);
      return 0;
    }
  }

  async getAccountBalance(accessKey: string, secretKey: string, currency: string): Promise<number> {
    try {
      const token = this.getAuthToken(accessKey, secretKey);
      const res = await axios.get(`${this.baseUrl}/accounts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const account = res.data.find((a: any) => a.currency === currency);
      return account ? parseFloat(account.balance) : 0;
    } catch (e) {
      return 0;
    }
  }

  async placeBuyOrder(
    accessKey: string,
    secretKey: string,
    market: string,
    price: number,
    volume?: number
  ): Promise<{ success: boolean; uuid?: string; message?: string }> {
    try {
      const params: any = {
        market,
        side: "bid",
        ord_type: "price", // 시장가 매수 (금액 기준)
        price: String(Math.floor(price)),
      };

      const query = querystring.stringify(params);
      const token = this.getAuthToken(accessKey, secretKey, query);

      const res = await axios.post(
        `${this.baseUrl}/orders`,
        params,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      return { success: true, uuid: res.data.uuid };
    } catch (e: any) {
      const errorMsg = e.response?.data?.error?.message || "주문 실패";
      console.error("Buy order failed:", e.response?.data);
      return { success: false, message: errorMsg };
    }
  }

  async placeSellOrder(
    accessKey: string,
    secretKey: string,
    market: string,
    volume: number
  ): Promise<{ success: boolean; uuid?: string; message?: string }> {
    try {
      const params: any = {
        market,
        side: "ask",
        ord_type: "market", // 시장가 매도
        volume: String(volume),
      };

      const query = querystring.stringify(params);
      const token = this.getAuthToken(accessKey, secretKey, query);

      const res = await axios.post(
        `${this.baseUrl}/orders`,
        params,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      return { success: true, uuid: res.data.uuid };
    } catch (e: any) {
      const errorMsg = e.response?.data?.error?.message || "주문 실패";
      console.error("Sell order failed:", e.response?.data);
      return { success: false, message: errorMsg };
    }
  }

  async getStatus(userId: string, marketOverride?: string) {
    const settings = await this.storage.getBotSettings(userId);
    const market = marketOverride || settings?.market || "KRW-BTC";
    
    let currentPrice = 0;
    try {
      const tickerRes = await axios.get(`${this.baseUrl}/ticker?markets=${market}`);
      currentPrice = tickerRes.data[0].trade_price;
    } catch (e) {
      console.error(`Failed to fetch price for ${market}:`, e);
    }

    let balanceKRW = 0;
    let balanceCoin = 0;

    if (settings?.upbitAccessKey && settings?.upbitSecretKey) {
      try {
        const token = this.getAuthToken(settings.upbitAccessKey, settings.upbitSecretKey);
        const accountsRes = await axios.get(`${this.baseUrl}/accounts`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        const krwAccount = accountsRes.data.find((a: any) => a.currency === "KRW");
        const coinAccount = accountsRes.data.find((a: any) => a.currency === market.split("-")[1]);

        balanceKRW = krwAccount ? parseFloat(krwAccount.balance) : 0;
        balanceCoin = coinAccount ? parseFloat(coinAccount.balance) : 0;
      } catch (e: any) {
        if (e.response?.data?.error) {
          console.error("Upbit API error:", e.response.data.error);
        }
      }
    }

    const totalAssetKRW = balanceKRW + (balanceCoin * currentPrice);

    return {
      market,
      currentPrice,
      balanceKRW,
      balanceCoin,
      totalAssetKRW,
      isActive: settings?.isActive || false,
    };
  }

  async verifyApiKeys(accessKey: string, secretKey: string): Promise<{ success: boolean; message: string }> {
    try {
      const token = this.getAuthToken(accessKey, secretKey);
      const accountsRes = await axios.get(`${this.baseUrl}/accounts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (accountsRes.data && Array.isArray(accountsRes.data)) {
        const krwAccount = accountsRes.data.find((a: any) => a.currency === "KRW");
        const balance = krwAccount ? parseFloat(krwAccount.balance) : 0;
        return { 
          success: true, 
          message: `API 키 확인 완료! KRW 잔고: ${balance.toLocaleString()}원` 
        };
      }
      return { success: false, message: "계좌 정보를 가져올 수 없습니다" };
    } catch (e: any) {
      console.error("API key verification failed - Full error:", JSON.stringify(e.response?.data, null, 2));
      const errorName = e.response?.data?.error?.name;
      const errorMsg = e.response?.data?.error?.message;
      
      if (errorName === "invalid_access_key") {
        return { success: false, message: "Access Key가 올바르지 않습니다." };
      } else if (errorName === "jwt_verification") {
        return { success: false, message: "Secret Key가 올바르지 않습니다." };
      } else if (errorName === "no_authorization_ip") {
        return { success: false, message: "IP 주소가 허용되지 않습니다. Upbit에서 '모든 IP 허용'으로 변경해주세요." };
      }
      
      return { 
        success: false, 
        message: errorMsg || "API 연결에 실패했습니다." 
      };
    }
  }

  private async executePercentStrategy(settings: BotSettings) {
    if (!settings.upbitAccessKey || !settings.upbitSecretKey) return;

    const userId = settings.userId;
    const market = settings.market;
    const buyThreshold = parseFloat(settings.buyThreshold || "0.5") / 100;
    const sellThreshold = parseFloat(settings.sellThreshold || "0.5") / 100;
    const targetAmount = parseFloat(settings.targetAmount || "10000");

    const currentPrice = await this.getCurrentPrice(market);
    if (currentPrice === 0) return;

    // Get reference price from database or initialize
    let referencePrice = settings.referencePrice ? parseFloat(settings.referencePrice) : 0;
    if (referencePrice === 0) {
      await this.storage.updateBotSettings(userId, { 
        referencePrice: String(currentPrice) 
      });
      console.log(`[BOT ${userId}] Reference price set: ${currentPrice.toLocaleString()}`);
      return;
    }

    const priceChange = (currentPrice - referencePrice) / referencePrice;

    // Prevent rapid trading (min 30 seconds between trades)
    const lastTradeTime = settings.lastTradeTime ? new Date(settings.lastTradeTime).getTime() : 0;
    if (Date.now() - lastTradeTime < 30000) return;

    const coinSymbol = market.split("-")[1];

    // BUY: Price dropped by threshold
    if (priceChange <= -buyThreshold) {
      const krwBalance = await this.getAccountBalance(settings.upbitAccessKey, settings.upbitSecretKey, "KRW");
      
      if (krwBalance >= targetAmount) {
        console.log(`[BOT ${userId}] BUY signal: ${(priceChange * 100).toFixed(2)}% drop, buying ${targetAmount.toLocaleString()} KRW`);
        
        const result = await this.placeBuyOrder(
          settings.upbitAccessKey,
          settings.upbitSecretKey,
          market,
          targetAmount
        );

        await this.storage.createTradeLog({
          userId,
          market,
          side: "bid",
          price: String(currentPrice),
          volume: String(targetAmount / currentPrice),
          status: result.success ? "success" : "failed",
          message: result.success ? `매수 완료: ${targetAmount.toLocaleString()}원` : result.message,
        });

        if (result.success) {
          await this.storage.updateBotSettings(userId, { 
            referencePrice: String(currentPrice),
            lastTradeTime: new Date()
          });
        }
      }
    }

    // SELL: Price rose by threshold
    if (priceChange >= sellThreshold) {
      const coinBalance = await this.getAccountBalance(settings.upbitAccessKey, settings.upbitSecretKey, coinSymbol);
      const minOrderValue = 5000; // Upbit minimum order
      
      if (coinBalance * currentPrice >= minOrderValue) {
        console.log(`[BOT ${userId}] SELL signal: ${(priceChange * 100).toFixed(2)}% rise, selling ${coinBalance} ${coinSymbol}`);
        
        const result = await this.placeSellOrder(
          settings.upbitAccessKey,
          settings.upbitSecretKey,
          market,
          coinBalance
        );

        await this.storage.createTradeLog({
          userId,
          market,
          side: "ask",
          price: String(currentPrice),
          volume: String(coinBalance),
          status: result.success ? "success" : "failed",
          message: result.success ? `매도 완료: ${coinBalance.toFixed(8)} ${coinSymbol}` : result.message,
        });

        if (result.success) {
          await this.storage.updateBotSettings(userId, { 
            referencePrice: String(currentPrice),
            lastTradeTime: new Date()
          });
        }
      }
    }
  }

  private async executeDCAStrategy(settings: BotSettings) {
    if (!settings.upbitAccessKey || !settings.upbitSecretKey) return;

    const userId = settings.userId;
    const market = settings.market;
    const targetAmount = parseFloat(settings.targetAmount || "10000");

    // DCA: Buy at regular intervals (every 1 hour)
    const lastTradeTime = settings.lastTradeTime ? new Date(settings.lastTradeTime).getTime() : 0;
    const hourInMs = 60 * 60 * 1000;
    
    if (Date.now() - lastTradeTime < hourInMs) return;

    const currentPrice = await this.getCurrentPrice(market);
    if (currentPrice === 0) return;

    const krwBalance = await this.getAccountBalance(settings.upbitAccessKey, settings.upbitSecretKey, "KRW");
    
    if (krwBalance >= targetAmount) {
      console.log(`[BOT ${userId}] DCA buy: ${targetAmount.toLocaleString()} KRW at ${currentPrice.toLocaleString()}`);
      
      const result = await this.placeBuyOrder(
        settings.upbitAccessKey,
        settings.upbitSecretKey,
        market,
        targetAmount
      );

      await this.storage.createTradeLog({
        userId,
        market,
        side: "bid",
        price: String(currentPrice),
        volume: String(targetAmount / currentPrice),
        status: result.success ? "success" : "failed",
        message: result.success ? `DCA 매수: ${targetAmount.toLocaleString()}원` : result.message,
      });

      if (result.success) {
        await this.storage.updateBotSettings(userId, { 
          lastTradeTime: new Date()
        });
      }
    }
  }

  private async executeGridStrategy(settings: BotSettings) {
    // Grid trading: Place orders at fixed price intervals
    // Uses buyThreshold as grid percentage step (e.g., 1% = buy when price drops 1%, 2%, 3%...)
    if (!settings.upbitAccessKey || !settings.upbitSecretKey) return;

    const userId = settings.userId;
    const market = settings.market;
    const gridStep = parseFloat(settings.buyThreshold || "1") / 100; // Grid step as percentage
    const targetAmount = parseFloat(settings.targetAmount || "10000");

    const currentPrice = await this.getCurrentPrice(market);
    if (currentPrice === 0) return;

    // Initialize reference price if not set
    let referencePrice = settings.referencePrice ? parseFloat(settings.referencePrice) : 0;
    if (referencePrice === 0) {
      await this.storage.updateBotSettings(userId, { 
        referencePrice: String(currentPrice) 
      });
      console.log(`[BOT ${userId}] Grid reference price set: ${currentPrice.toLocaleString()}`);
      return;
    }

    // Prevent rapid trading (min 30 seconds between trades)
    const lastTradeTime = settings.lastTradeTime ? new Date(settings.lastTradeTime).getTime() : 0;
    if (Date.now() - lastTradeTime < 30000) return;

    const priceChange = (currentPrice - referencePrice) / referencePrice;
    const coinSymbol = market.split("-")[1];

    // Calculate how many grid levels price has moved
    const gridLevels = Math.floor(Math.abs(priceChange) / gridStep);
    
    if (gridLevels >= 1) {
      // BUY: Price dropped by one or more grid levels
      if (priceChange < 0) {
        const krwBalance = await this.getAccountBalance(settings.upbitAccessKey, settings.upbitSecretKey, "KRW");
        const buyAmount = targetAmount * gridLevels; // Buy more for larger drops
        
        if (krwBalance >= buyAmount) {
          console.log(`[BOT ${userId}] Grid BUY: ${gridLevels} levels down, buying ${buyAmount.toLocaleString()} KRW`);
          
          const result = await this.placeBuyOrder(
            settings.upbitAccessKey,
            settings.upbitSecretKey,
            market,
            buyAmount
          );

          await this.storage.createTradeLog({
            userId,
            market,
            side: "bid",
            price: String(currentPrice),
            volume: String(buyAmount / currentPrice),
            status: result.success ? "success" : "failed",
            message: result.success ? `그리드 매수 (${gridLevels}단계): ${buyAmount.toLocaleString()}원` : result.message,
          });

          if (result.success) {
            // Update reference price to current grid level
            const newRef = referencePrice * (1 - gridStep * gridLevels);
            await this.storage.updateBotSettings(userId, { 
              referencePrice: String(newRef),
              lastTradeTime: new Date()
            });
          }
        }
      }
      // SELL: Price rose by one or more grid levels
      else if (priceChange > 0) {
        const coinBalance = await this.getAccountBalance(settings.upbitAccessKey, settings.upbitSecretKey, coinSymbol);
        const minOrderValue = 5000;
        
        // Sell proportional to grid levels (but not more than total balance)
        const sellRatio = Math.min(gridLevels * 0.25, 1); // 25% per grid level, max 100%
        const sellAmount = coinBalance * sellRatio;
        
        if (sellAmount * currentPrice >= minOrderValue) {
          console.log(`[BOT ${userId}] Grid SELL: ${gridLevels} levels up, selling ${(sellRatio * 100).toFixed(0)}% (${sellAmount.toFixed(8)} ${coinSymbol})`);
          
          const result = await this.placeSellOrder(
            settings.upbitAccessKey,
            settings.upbitSecretKey,
            market,
            sellAmount
          );

          await this.storage.createTradeLog({
            userId,
            market,
            side: "ask",
            price: String(currentPrice),
            volume: String(sellAmount),
            status: result.success ? "success" : "failed",
            message: result.success ? `그리드 매도 (${gridLevels}단계): ${sellAmount.toFixed(8)} ${coinSymbol}` : result.message,
          });

          if (result.success) {
            // Update reference price to current grid level
            const newRef = referencePrice * (1 + gridStep * gridLevels);
            await this.storage.updateBotSettings(userId, { 
              referencePrice: String(newRef),
              lastTradeTime: new Date()
            });
          }
        }
      }
    }
  }

  startLoop() {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log("[BOT] Trading bot started");

    setInterval(async () => {
      try {
        const activeSettings = await this.storage.getAllActiveSettings();
        
        for (const settings of activeSettings) {
          if (!settings.upbitAccessKey || !settings.upbitSecretKey) continue;

          const strategy = settings.strategy || "percent";

          switch (strategy) {
            case "percent":
              await this.executePercentStrategy(settings);
              break;
            case "dca":
              await this.executeDCAStrategy(settings);
              break;
            case "grid":
              await this.executeGridStrategy(settings);
              break;
          }
        }
      } catch (e) {
        console.error("[BOT] Error in trading loop:", e);
      }
    }, 10000); // Check every 10 seconds
  }
}
