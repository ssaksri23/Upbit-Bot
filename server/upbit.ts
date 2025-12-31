import axios from "axios";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import querystring from "querystring";
import { IStorage } from "./storage";
import { BotSettings } from "@shared/schema";

interface CandleData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export class UpbitService {
  private storage: IStorage;
  private baseUrl = "https://api.upbit.com/v1";
  private isRunning = false;
  private priceHistory: Map<string, CandleData[]> = new Map(); // market -> candles

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

  // Fetch minute candles for technical analysis
  async getCandles(market: string, count: number = 60): Promise<CandleData[]> {
    try {
      const res = await axios.get(`${this.baseUrl}/candles/minutes/1?market=${market}&count=${count}`);
      return res.data.map((c: any) => ({
        timestamp: new Date(c.candle_date_time_kst).getTime(),
        open: c.opening_price,
        high: c.high_price,
        low: c.low_price,
        close: c.trade_price,
        volume: c.candle_acc_trade_volume,
      })).reverse(); // Oldest first
    } catch (e) {
      console.error(`Failed to fetch candles for ${market}:`, e);
      return [];
    }
  }

  // Calculate RSI (Relative Strength Index)
  private calculateRSI(prices: number[], period: number = 14): number {
    if (prices.length < period + 1) return 50; // Not enough data

    let gains = 0;
    let losses = 0;

    for (let i = prices.length - period; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) gains += change;
      else losses += Math.abs(change);
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  // Calculate Simple Moving Average
  private calculateSMA(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1] || 0;
    const slice = prices.slice(-period);
    return slice.reduce((sum, p) => sum + p, 0) / period;
  }

  // Calculate Bollinger Bands
  private calculateBollingerBands(prices: number[], period: number = 20, stdDev: number = 2): { upper: number; middle: number; lower: number } {
    const sma = this.calculateSMA(prices, period);
    
    if (prices.length < period) {
      return { upper: sma, middle: sma, lower: sma };
    }

    const slice = prices.slice(-period);
    const variance = slice.reduce((sum, p) => sum + Math.pow(p - sma, 2), 0) / period;
    const std = Math.sqrt(variance);

    return {
      upper: sma + (stdDev * std),
      middle: sma,
      lower: sma - (stdDev * std),
    };
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

    // Calculate profit/loss from trade logs
    const logs = await this.storage.getTradeLogs(userId);
    let totalInvested = 0; // Total KRW spent on buys
    let totalReturned = 0; // Total KRW received from sells
    let todayProfitLoss = 0;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const log of logs) {
      if (log.status !== 'success') continue;
      
      const price = parseFloat(String(log.price));
      const volume = parseFloat(String(log.volume));
      const value = price * volume;
      
      if (log.side === 'bid') {
        totalInvested += value;
      } else if (log.side === 'ask') {
        totalReturned += value;
      }

      // Today's P/L
      if (log.timestamp && new Date(log.timestamp) >= today) {
        if (log.side === 'ask') {
          todayProfitLoss += value;
        } else if (log.side === 'bid') {
          todayProfitLoss -= value;
        }
      }
    }

    // Current holdings value (unrealized)
    const currentHoldingsValue = balanceCoin * currentPrice;
    
    // Total realized + unrealized profit/loss
    const profitLoss = (totalReturned + currentHoldingsValue) - totalInvested;
    const profitLossPercent = totalInvested > 0 ? (profitLoss / totalInvested) * 100 : 0;

    return {
      market,
      currentPrice,
      balanceKRW,
      balanceCoin,
      totalAssetKRW,
      isActive: settings?.isActive || false,
      totalInvested,
      totalReturned,
      profitLoss,
      profitLossPercent,
      todayProfitLoss,
      tradeCount: logs.filter(l => l.status === 'success').length,
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

  async getRecommendations(): Promise<{
    market: string;
    koreanName: string;
    englishName: string;
    currentPrice: number;
    changeRate: number;
    volume24h: number;
    rsi: number;
    signal: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
    reason: string;
  }[]> {
    try {
      // Get all KRW markets
      const markets = await this.getMarkets();
      
      // Get ticker data for all markets
      const marketCodes = markets.map(m => m.market).join(',');
      const tickerRes = await axios.get(`${this.baseUrl}/ticker?markets=${marketCodes}`);
      const tickers = tickerRes.data;

      // Analyze top 5 by volume
      const sortedByVolume = tickers
        .sort((a: any, b: any) => b.acc_trade_price_24h - a.acc_trade_price_24h)
        .slice(0, 5);

      const recommendations = [];

      for (const ticker of sortedByVolume) {
        const marketInfo = markets.find(m => m.market === ticker.market);
        if (!marketInfo) continue;

        // Get candle data for RSI calculation
        let rsi = 50;
        try {
          const candlesRes = await axios.get(
            `${this.baseUrl}/candles/minutes/15?market=${ticker.market}&count=20`
          );
          const candles = candlesRes.data;
          
          if (candles.length >= 14) {
            // Calculate RSI
            let gains = 0, losses = 0;
            for (let i = 1; i < Math.min(15, candles.length); i++) {
              const change = candles[i - 1].trade_price - candles[i].trade_price;
              if (change > 0) gains += change;
              else losses -= change;
            }
            const avgGain = gains / 14;
            const avgLoss = losses / 14;
            const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
            rsi = 100 - (100 / (1 + rs));
          }
        } catch (e) {
          // Skip if candle fetch fails
        }

        const changeRate = ticker.signed_change_rate * 100;
        
        // Determine signal based on RSI and change rate
        let signal: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell' = 'hold';
        let reason = '';

        if (rsi < 30 && changeRate < -3) {
          signal = 'strong_buy';
          reason = 'RSI 과매도 + 급락';
        } else if (rsi < 30) {
          signal = 'buy';
          reason = 'RSI 과매도';
        } else if (rsi > 70 && changeRate > 3) {
          signal = 'strong_sell';
          reason = 'RSI 과매수 + 급등';
        } else if (rsi > 70) {
          signal = 'sell';
          reason = 'RSI 과매수';
        } else if (changeRate < -5) {
          signal = 'buy';
          reason = '급락 반등 기대';
        } else if (changeRate > 5) {
          signal = 'sell';
          reason = '급등 조정 예상';
        } else {
          signal = 'hold';
          reason = '관망';
        }

        recommendations.push({
          market: ticker.market,
          koreanName: marketInfo.korean_name,
          englishName: marketInfo.english_name,
          currentPrice: ticker.trade_price,
          changeRate,
          volume24h: ticker.acc_trade_price_24h,
          rsi: Math.round(rsi),
          signal,
          reason,
        });

        // Rate limit - avoid too many requests
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Sort by signal priority
      const signalPriority = { strong_buy: 0, buy: 1, hold: 2, sell: 3, strong_sell: 4 };
      recommendations.sort((a, b) => signalPriority[a.signal] - signalPriority[b.signal]);

      return recommendations;
    } catch (e) {
      console.error("Failed to get recommendations:", e);
      return [];
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

  // RSI Strategy: Buy when oversold (RSI < 30), sell when overbought (RSI > 70)
  private async executeRSIStrategy(settings: BotSettings) {
    if (!settings.upbitAccessKey || !settings.upbitSecretKey) return;

    const userId = settings.userId;
    const market = settings.market;
    const targetAmount = parseFloat(settings.targetAmount || "10000");
    const buyThreshold = parseFloat(settings.buyThreshold || "30"); // RSI buy level
    const sellThreshold = parseFloat(settings.sellThreshold || "70"); // RSI sell level

    // Prevent rapid trading
    const lastTradeTime = settings.lastTradeTime ? new Date(settings.lastTradeTime).getTime() : 0;
    if (Date.now() - lastTradeTime < 60000) return; // Min 1 minute between trades

    const candles = await this.getCandles(market, 30);
    if (candles.length < 15) return;

    const prices = candles.map(c => c.close);
    const currentPrice = prices[prices.length - 1];
    const rsi = this.calculateRSI(prices, 14);

    const coinSymbol = market.split("-")[1];

    // Oversold - Buy signal
    if (rsi < buyThreshold) {
      const krwBalance = await this.getAccountBalance(settings.upbitAccessKey, settings.upbitSecretKey, "KRW");
      
      if (krwBalance >= targetAmount) {
        console.log(`[BOT ${userId}] RSI=${rsi.toFixed(1)} < ${buyThreshold} - BUY signal`);
        
        const result = await this.placeBuyOrder(settings.upbitAccessKey, settings.upbitSecretKey, market, targetAmount);

        await this.storage.createTradeLog({
          userId, market, side: "bid",
          price: String(currentPrice),
          volume: String(targetAmount / currentPrice),
          status: result.success ? "success" : "failed",
          message: result.success ? `RSI 매수 (RSI=${rsi.toFixed(1)}): ${targetAmount.toLocaleString()}원` : result.message,
        });

        if (result.success) {
          await this.storage.updateBotSettings(userId, { lastTradeTime: new Date() });
        }
      }
    }
    // Overbought - Sell signal
    else if (rsi > sellThreshold) {
      const coinBalance = await this.getAccountBalance(settings.upbitAccessKey, settings.upbitSecretKey, coinSymbol);
      const minOrderValue = 5000;
      
      if (coinBalance * currentPrice >= minOrderValue) {
        console.log(`[BOT ${userId}] RSI=${rsi.toFixed(1)} > ${sellThreshold} - SELL signal`);
        
        const result = await this.placeSellOrder(settings.upbitAccessKey, settings.upbitSecretKey, market, coinBalance);

        await this.storage.createTradeLog({
          userId, market, side: "ask",
          price: String(currentPrice),
          volume: String(coinBalance),
          status: result.success ? "success" : "failed",
          message: result.success ? `RSI 매도 (RSI=${rsi.toFixed(1)}): ${coinBalance.toFixed(8)} ${coinSymbol}` : result.message,
        });

        if (result.success) {
          await this.storage.updateBotSettings(userId, { lastTradeTime: new Date() });
        }
      }
    }
  }

  // Moving Average Crossover Strategy: Buy when short MA crosses above long MA
  private async executeMAStrategy(settings: BotSettings) {
    if (!settings.upbitAccessKey || !settings.upbitSecretKey) return;

    const userId = settings.userId;
    const market = settings.market;
    const targetAmount = parseFloat(settings.targetAmount || "10000");
    const shortPeriod = Math.floor(parseFloat(settings.buyThreshold || "5")); // Short MA period
    const longPeriod = Math.floor(parseFloat(settings.sellThreshold || "20")); // Long MA period

    // Prevent rapid trading
    const lastTradeTime = settings.lastTradeTime ? new Date(settings.lastTradeTime).getTime() : 0;
    if (Date.now() - lastTradeTime < 60000) return;

    const candles = await this.getCandles(market, 60);
    if (candles.length < longPeriod + 2) return;

    const prices = candles.map(c => c.close);
    const currentPrice = prices[prices.length - 1];
    
    // Calculate current and previous MAs
    const shortMA = this.calculateSMA(prices, shortPeriod);
    const longMA = this.calculateSMA(prices, longPeriod);
    const prevShortMA = this.calculateSMA(prices.slice(0, -1), shortPeriod);
    const prevLongMA = this.calculateSMA(prices.slice(0, -1), longPeriod);

    const coinSymbol = market.split("-")[1];

    // Golden Cross: Short MA crosses above Long MA - Buy signal
    if (prevShortMA <= prevLongMA && shortMA > longMA) {
      const krwBalance = await this.getAccountBalance(settings.upbitAccessKey, settings.upbitSecretKey, "KRW");
      
      if (krwBalance >= targetAmount) {
        console.log(`[BOT ${userId}] MA Golden Cross - BUY signal (Short:${shortMA.toFixed(0)} > Long:${longMA.toFixed(0)})`);
        
        const result = await this.placeBuyOrder(settings.upbitAccessKey, settings.upbitSecretKey, market, targetAmount);

        await this.storage.createTradeLog({
          userId, market, side: "bid",
          price: String(currentPrice),
          volume: String(targetAmount / currentPrice),
          status: result.success ? "success" : "failed",
          message: result.success ? `MA 골든크로스 매수: ${targetAmount.toLocaleString()}원` : result.message,
        });

        if (result.success) {
          await this.storage.updateBotSettings(userId, { lastTradeTime: new Date() });
        }
      }
    }
    // Death Cross: Short MA crosses below Long MA - Sell signal
    else if (prevShortMA >= prevLongMA && shortMA < longMA) {
      const coinBalance = await this.getAccountBalance(settings.upbitAccessKey, settings.upbitSecretKey, coinSymbol);
      const minOrderValue = 5000;
      
      if (coinBalance * currentPrice >= minOrderValue) {
        console.log(`[BOT ${userId}] MA Death Cross - SELL signal (Short:${shortMA.toFixed(0)} < Long:${longMA.toFixed(0)})`);
        
        const result = await this.placeSellOrder(settings.upbitAccessKey, settings.upbitSecretKey, market, coinBalance);

        await this.storage.createTradeLog({
          userId, market, side: "ask",
          price: String(currentPrice),
          volume: String(coinBalance),
          status: result.success ? "success" : "failed",
          message: result.success ? `MA 데드크로스 매도: ${coinBalance.toFixed(8)} ${coinSymbol}` : result.message,
        });

        if (result.success) {
          await this.storage.updateBotSettings(userId, { lastTradeTime: new Date() });
        }
      }
    }
  }

  // Bollinger Bands Strategy: Buy at lower band, sell at upper band
  private async executeBollingerStrategy(settings: BotSettings) {
    if (!settings.upbitAccessKey || !settings.upbitSecretKey) return;

    const userId = settings.userId;
    const market = settings.market;
    const targetAmount = parseFloat(settings.targetAmount || "10000");

    // Prevent rapid trading
    const lastTradeTime = settings.lastTradeTime ? new Date(settings.lastTradeTime).getTime() : 0;
    if (Date.now() - lastTradeTime < 60000) return;

    const candles = await this.getCandles(market, 30);
    if (candles.length < 20) return;

    const prices = candles.map(c => c.close);
    const currentPrice = prices[prices.length - 1];
    const bands = this.calculateBollingerBands(prices, 20, 2);

    const coinSymbol = market.split("-")[1];

    // Price touches lower band - Buy signal
    if (currentPrice <= bands.lower) {
      const krwBalance = await this.getAccountBalance(settings.upbitAccessKey, settings.upbitSecretKey, "KRW");
      
      if (krwBalance >= targetAmount) {
        console.log(`[BOT ${userId}] Bollinger: Price ${currentPrice} <= Lower ${bands.lower.toFixed(0)} - BUY`);
        
        const result = await this.placeBuyOrder(settings.upbitAccessKey, settings.upbitSecretKey, market, targetAmount);

        await this.storage.createTradeLog({
          userId, market, side: "bid",
          price: String(currentPrice),
          volume: String(targetAmount / currentPrice),
          status: result.success ? "success" : "failed",
          message: result.success ? `볼린저 하단 매수: ${targetAmount.toLocaleString()}원` : result.message,
        });

        if (result.success) {
          await this.storage.updateBotSettings(userId, { lastTradeTime: new Date() });
        }
      }
    }
    // Price touches upper band - Sell signal
    else if (currentPrice >= bands.upper) {
      const coinBalance = await this.getAccountBalance(settings.upbitAccessKey, settings.upbitSecretKey, coinSymbol);
      const minOrderValue = 5000;
      
      if (coinBalance * currentPrice >= minOrderValue) {
        console.log(`[BOT ${userId}] Bollinger: Price ${currentPrice} >= Upper ${bands.upper.toFixed(0)} - SELL`);
        
        const result = await this.placeSellOrder(settings.upbitAccessKey, settings.upbitSecretKey, market, coinBalance);

        await this.storage.createTradeLog({
          userId, market, side: "ask",
          price: String(currentPrice),
          volume: String(coinBalance),
          status: result.success ? "success" : "failed",
          message: result.success ? `볼린저 상단 매도: ${coinBalance.toFixed(8)} ${coinSymbol}` : result.message,
        });

        if (result.success) {
          await this.storage.updateBotSettings(userId, { lastTradeTime: new Date() });
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
            case "rsi":
              await this.executeRSIStrategy(settings);
              break;
            case "ma":
              await this.executeMAStrategy(settings);
              break;
            case "bollinger":
              await this.executeBollingerStrategy(settings);
              break;
          }
        }
      } catch (e) {
        console.error("[BOT] Error in trading loop:", e);
      }
    }, 10000); // Check every 10 seconds
  }
}
