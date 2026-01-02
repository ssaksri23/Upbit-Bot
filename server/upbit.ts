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

  // 수수료율 가져오기 (기본 0.05%)
  private getFeeRate(settings: BotSettings): number {
    return parseFloat(settings.feeRate || "0.0005");
  }

  // 수수료 버퍼 계산 (왕복 수수료 + 슬리피지 마진)
  private getFeeBuffer(settings: BotSettings): number {
    const feeRate = this.getFeeRate(settings);
    const roundTripFee = feeRate * 2; // 매수 + 매도 수수료
    const slippageMargin = 0.0005; // 0.05% 슬리피지 마진
    return roundTripFee + slippageMargin; // 총 ~0.15%
  }

  // 수수료 금액 계산
  private calculateFee(amount: number, settings: BotSettings): number {
    const feeRate = this.getFeeRate(settings);
    return amount * feeRate;
  }

  private async executePercentStrategy(settings: BotSettings) {
    if (!settings.upbitAccessKey || !settings.upbitSecretKey) return;

    const userId = settings.userId;
    const market = settings.market;
    const buyThreshold = parseFloat(settings.buyThreshold || "0.5") / 100;
    const sellThreshold = parseFloat(settings.sellThreshold || "0.5") / 100;
    const targetAmount = parseFloat(settings.targetAmount || "10000");
    const feeBuffer = this.getFeeBuffer(settings);

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

    // BUY: Price dropped by threshold (반드시 수수료 이상 하락해야 매수)
    // 매수 후 매도 시 수익이 나려면 buyThreshold + feeBuffer 이상 하락해야 함
    const effectiveBuyThreshold = Math.max(buyThreshold, feeBuffer);
    
    if (priceChange <= -effectiveBuyThreshold) {
      const krwBalance = await this.getAccountBalance(settings.upbitAccessKey, settings.upbitSecretKey, "KRW");
      
      if (krwBalance >= targetAmount) {
        const feePaid = this.calculateFee(targetAmount, settings);
        console.log(`[BOT ${userId}] BUY signal: ${(priceChange * 100).toFixed(2)}% drop (threshold: ${(effectiveBuyThreshold * 100).toFixed(2)}%), buying ${targetAmount.toLocaleString()} KRW, fee: ${feePaid.toFixed(0)} KRW`);
        
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
          message: result.success ? `매수 완료: ${targetAmount.toLocaleString()}원 (수수료: ${feePaid.toFixed(0)}원)` : result.message,
          feePaid: result.success ? String(feePaid) : null,
        });

        if (result.success) {
          await this.storage.updateBotSettings(userId, { 
            referencePrice: String(currentPrice),
            lastTradeTime: new Date()
          });
        }
      }
    }

    // SELL: Price rose by threshold (수수료 이상 상승해야 매도)
    // 수익이 나려면 sellThreshold > feeBuffer 이어야 함
    const effectiveSellThreshold = Math.max(sellThreshold, feeBuffer);
    
    if (priceChange >= effectiveSellThreshold) {
      const coinBalance = await this.getAccountBalance(settings.upbitAccessKey, settings.upbitSecretKey, coinSymbol);
      const minOrderValue = 5000; // Upbit minimum order
      const orderValue = coinBalance * currentPrice;
      
      if (orderValue >= minOrderValue) {
        const feePaid = this.calculateFee(orderValue, settings);
        console.log(`[BOT ${userId}] SELL signal: ${(priceChange * 100).toFixed(2)}% rise (threshold: ${(effectiveSellThreshold * 100).toFixed(2)}%), selling ${coinBalance} ${coinSymbol}, fee: ${feePaid.toFixed(0)} KRW`);
        
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
          message: result.success ? `매도 완료: ${coinBalance.toFixed(8)} ${coinSymbol} (수수료: ${feePaid.toFixed(0)}원)` : result.message,
          feePaid: result.success ? String(feePaid) : null,
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

  // DCA Strategy: Buy at regular intervals
  // Fee-aware: Only buy when price is in drawdown (better entry) or ATR indicates profitable volatility
  private async executeDCAStrategy(settings: BotSettings) {
    if (!settings.upbitAccessKey || !settings.upbitSecretKey) return;

    const userId = settings.userId;
    const market = settings.market;
    const targetAmount = parseFloat(settings.targetAmount || "10000");
    const feeBuffer = this.getFeeBuffer(settings);

    // DCA: Buy at regular intervals (every 1 hour)
    const lastTradeTime = settings.lastTradeTime ? new Date(settings.lastTradeTime).getTime() : 0;
    const hourInMs = 60 * 60 * 1000;
    
    if (Date.now() - lastTradeTime < hourInMs) return;

    const candles = await this.getCandles(market, 30);
    if (candles.length < 15) return;
    
    const currentPrice = candles[candles.length - 1].close;
    if (currentPrice === 0) return;
    
    // DCA should buy regularly - only skip if price is significantly above average
    // This ensures DCA works as intended while still being somewhat fee-conscious
    const prices = candles.map(c => c.close);
    const recentAvg = prices.slice(-10).reduce((a, b) => a + b, 0) / 10;
    const priceVsAvg = (currentPrice - recentAvg) / recentAvg;
    
    // Only skip if price is significantly above recent average (bad DCA entry)
    // Use 3x fee buffer (~0.45%) as threshold to not be too restrictive
    if (priceVsAvg > feeBuffer * 3) {
      console.log(`[BOT ${userId}] DCA skip: price ${(priceVsAvg * 100).toFixed(2)}% above avg, waiting for better entry`);
      return;
    }

    const krwBalance = await this.getAccountBalance(settings.upbitAccessKey, settings.upbitSecretKey, "KRW");
    
    if (krwBalance >= targetAmount) {
      const feePaid = this.calculateFee(targetAmount, settings);
      console.log(`[BOT ${userId}] DCA buy: ${targetAmount.toLocaleString()} KRW at ${currentPrice.toLocaleString()}, fee: ${feePaid.toFixed(0)} KRW`);
      
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
        message: result.success ? `DCA 매수: ${targetAmount.toLocaleString()}원 (수수료: ${feePaid.toFixed(0)}원)` : result.message,
        feePaid: result.success ? String(feePaid) : null,
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
    const feeBuffer = this.getFeeBuffer(settings);

    const currentPrice = await this.getCurrentPrice(market);
    if (currentPrice === 0) return;

    // Grid step must be larger than fee buffer to be profitable
    const effectiveGridStep = Math.max(gridStep, feeBuffer);

    // Initialize reference price if not set
    let referencePrice = settings.referencePrice ? parseFloat(settings.referencePrice) : 0;
    if (referencePrice === 0) {
      await this.storage.updateBotSettings(userId, { 
        referencePrice: String(currentPrice) 
      });
      console.log(`[BOT ${userId}] Grid reference price set: ${currentPrice.toLocaleString()}, effective step: ${(effectiveGridStep * 100).toFixed(2)}%`);
      return;
    }

    // Prevent rapid trading (min 30 seconds between trades)
    const lastTradeTime = settings.lastTradeTime ? new Date(settings.lastTradeTime).getTime() : 0;
    if (Date.now() - lastTradeTime < 30000) return;

    const priceChange = (currentPrice - referencePrice) / referencePrice;
    const coinSymbol = market.split("-")[1];

    // Calculate how many grid levels price has moved (using fee-adjusted step)
    const gridLevels = Math.floor(Math.abs(priceChange) / effectiveGridStep);
    
    if (gridLevels >= 1) {
      // BUY: Price dropped by one or more grid levels
      if (priceChange < 0) {
        const krwBalance = await this.getAccountBalance(settings.upbitAccessKey, settings.upbitSecretKey, "KRW");
        const buyAmount = targetAmount * gridLevels; // Buy more for larger drops
        
        if (krwBalance >= buyAmount) {
          const feePaid = this.calculateFee(buyAmount, settings);
          console.log(`[BOT ${userId}] Grid BUY: ${gridLevels} levels down, buying ${buyAmount.toLocaleString()} KRW, fee: ${feePaid.toFixed(0)} KRW`);
          
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
            message: result.success ? `그리드 매수 (${gridLevels}단계): ${buyAmount.toLocaleString()}원 (수수료: ${feePaid.toFixed(0)}원)` : result.message,
            feePaid: result.success ? String(feePaid) : null,
          });

          if (result.success) {
            // Update reference price to current grid level
            const newRef = referencePrice * (1 - effectiveGridStep * gridLevels);
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
        const orderValue = sellAmount * currentPrice;
        
        if (orderValue >= minOrderValue) {
          const feePaid = this.calculateFee(orderValue, settings);
          console.log(`[BOT ${userId}] Grid SELL: ${gridLevels} levels up, selling ${(sellRatio * 100).toFixed(0)}% (${sellAmount.toFixed(8)} ${coinSymbol}), fee: ${feePaid.toFixed(0)} KRW`);
          
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
            message: result.success ? `그리드 매도 (${gridLevels}단계): ${sellAmount.toFixed(8)} ${coinSymbol} (수수료: ${feePaid.toFixed(0)}원)` : result.message,
            feePaid: result.success ? String(feePaid) : null,
          });

          if (result.success) {
            // Update reference price to current grid level
            const newRef = referencePrice * (1 + effectiveGridStep * gridLevels);
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
  // Fee-aware: Only trade when expected price movement (ATR) can cover fees
  private async executeRSIStrategy(settings: BotSettings) {
    if (!settings.upbitAccessKey || !settings.upbitSecretKey) return;

    const userId = settings.userId;
    const market = settings.market;
    const targetAmount = parseFloat(settings.targetAmount || "10000");
    const buyThreshold = parseFloat(settings.buyThreshold || "30"); // RSI buy level
    const sellThreshold = parseFloat(settings.sellThreshold || "70"); // RSI sell level
    const feeBuffer = this.getFeeBuffer(settings);

    // Prevent rapid trading
    const lastTradeTime = settings.lastTradeTime ? new Date(settings.lastTradeTime).getTime() : 0;
    if (Date.now() - lastTradeTime < 60000) return; // Min 1 minute between trades

    const candles = await this.getCandles(market, 30);
    if (candles.length < 15) return;

    const prices = candles.map(c => c.close);
    const currentPrice = prices[prices.length - 1];
    const rsi = this.calculateRSI(prices, 14);
    
    // Fee logging only - RSI signals are strong technical indicators
    // We log expected volatility but don't block trades (user trusts RSI signals)

    const coinSymbol = market.split("-")[1];

    // Oversold - Buy signal
    if (rsi < buyThreshold) {
      const krwBalance = await this.getAccountBalance(settings.upbitAccessKey, settings.upbitSecretKey, "KRW");
      
      if (krwBalance >= targetAmount) {
        const feePaid = this.calculateFee(targetAmount, settings);
        console.log(`[BOT ${userId}] RSI=${rsi.toFixed(1)} < ${buyThreshold} - BUY signal, ATR: ${(expectedMovePct * 100).toFixed(2)}%, fee: ${feePaid.toFixed(0)} KRW`);
        
        const result = await this.placeBuyOrder(settings.upbitAccessKey, settings.upbitSecretKey, market, targetAmount);

        await this.storage.createTradeLog({
          userId, market, side: "bid",
          price: String(currentPrice),
          volume: String(targetAmount / currentPrice),
          status: result.success ? "success" : "failed",
          message: result.success ? `RSI 매수 (RSI=${rsi.toFixed(1)}): ${targetAmount.toLocaleString()}원 (수수료: ${feePaid.toFixed(0)}원)` : result.message,
          feePaid: result.success ? String(feePaid) : null,
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
      const orderValue = coinBalance * currentPrice;
      
      if (orderValue >= minOrderValue) {
        const feePaid = this.calculateFee(orderValue, settings);
        console.log(`[BOT ${userId}] RSI=${rsi.toFixed(1)} > ${sellThreshold} - SELL signal, ATR: ${(expectedMovePct * 100).toFixed(2)}%, fee: ${feePaid.toFixed(0)} KRW`);
        
        const result = await this.placeSellOrder(settings.upbitAccessKey, settings.upbitSecretKey, market, coinBalance);

        await this.storage.createTradeLog({
          userId, market, side: "ask",
          price: String(currentPrice),
          volume: String(coinBalance),
          status: result.success ? "success" : "failed",
          message: result.success ? `RSI 매도 (RSI=${rsi.toFixed(1)}): ${coinBalance.toFixed(8)} ${coinSymbol} (수수료: ${feePaid.toFixed(0)}원)` : result.message,
          feePaid: result.success ? String(feePaid) : null,
        });

        if (result.success) {
          await this.storage.updateBotSettings(userId, { lastTradeTime: new Date() });
        }
      }
    }
  }

  // Moving Average Crossover Strategy: Buy when short MA crosses above long MA
  // Fee-aware: Only trade when MA spread can cover fees
  private async executeMAStrategy(settings: BotSettings) {
    if (!settings.upbitAccessKey || !settings.upbitSecretKey) return;

    const userId = settings.userId;
    const market = settings.market;
    const targetAmount = parseFloat(settings.targetAmount || "10000");
    const shortPeriod = Math.floor(parseFloat(settings.buyThreshold || "5")); // Short MA period
    const longPeriod = Math.floor(parseFloat(settings.sellThreshold || "20")); // Long MA period
    const feeBuffer = this.getFeeBuffer(settings);

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
    
    // Fee logging only - MA crossovers are reliable trend signals
    // We log spread but don't block trades (crossovers often lead to sustained moves)

    const coinSymbol = market.split("-")[1];

    // Golden Cross: Short MA crosses above Long MA - Buy signal
    if (prevShortMA <= prevLongMA && shortMA > longMA) {
      const krwBalance = await this.getAccountBalance(settings.upbitAccessKey, settings.upbitSecretKey, "KRW");
      
      if (krwBalance >= targetAmount) {
        const feePaid = this.calculateFee(targetAmount, settings);
        console.log(`[BOT ${userId}] MA Golden Cross - BUY signal (Short:${shortMA.toFixed(0)} > Long:${longMA.toFixed(0)}), fee: ${feePaid.toFixed(0)} KRW`);
        
        const result = await this.placeBuyOrder(settings.upbitAccessKey, settings.upbitSecretKey, market, targetAmount);

        await this.storage.createTradeLog({
          userId, market, side: "bid",
          price: String(currentPrice),
          volume: String(targetAmount / currentPrice),
          status: result.success ? "success" : "failed",
          message: result.success ? `MA 골든크로스 매수: ${targetAmount.toLocaleString()}원 (수수료: ${feePaid.toFixed(0)}원)` : result.message,
          feePaid: result.success ? String(feePaid) : null,
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
      const orderValue = coinBalance * currentPrice;
      
      if (orderValue >= minOrderValue) {
        const feePaid = this.calculateFee(orderValue, settings);
        console.log(`[BOT ${userId}] MA Death Cross - SELL signal (Short:${shortMA.toFixed(0)} < Long:${longMA.toFixed(0)}), fee: ${feePaid.toFixed(0)} KRW`);
        
        const result = await this.placeSellOrder(settings.upbitAccessKey, settings.upbitSecretKey, market, coinBalance);

        await this.storage.createTradeLog({
          userId, market, side: "ask",
          price: String(currentPrice),
          volume: String(coinBalance),
          status: result.success ? "success" : "failed",
          message: result.success ? `MA 데드크로스 매도: ${coinBalance.toFixed(8)} ${coinSymbol} (수수료: ${feePaid.toFixed(0)}원)` : result.message,
          feePaid: result.success ? String(feePaid) : null,
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
    const feeBuffer = this.getFeeBuffer(settings);

    // Prevent rapid trading
    const lastTradeTime = settings.lastTradeTime ? new Date(settings.lastTradeTime).getTime() : 0;
    if (Date.now() - lastTradeTime < 60000) return;

    const candles = await this.getCandles(market, 30);
    if (candles.length < 20) return;

    const prices = candles.map(c => c.close);
    const currentPrice = prices[prices.length - 1];
    const bands = this.calculateBollingerBands(prices, 20, 2);

    const coinSymbol = market.split("-")[1];
    
    // Check if band width is profitable (upper-lower > feeBuffer)
    const bandWidthPercent = (bands.upper - bands.lower) / bands.middle;
    if (bandWidthPercent < feeBuffer * 2) {
      // Band too narrow for profitable trades after fees
      return;
    }

    // Price touches lower band - Buy signal
    if (currentPrice <= bands.lower) {
      const krwBalance = await this.getAccountBalance(settings.upbitAccessKey, settings.upbitSecretKey, "KRW");
      
      if (krwBalance >= targetAmount) {
        const feePaid = this.calculateFee(targetAmount, settings);
        console.log(`[BOT ${userId}] Bollinger: Price ${currentPrice} <= Lower ${bands.lower.toFixed(0)} - BUY, fee: ${feePaid.toFixed(0)} KRW`);
        
        const result = await this.placeBuyOrder(settings.upbitAccessKey, settings.upbitSecretKey, market, targetAmount);

        await this.storage.createTradeLog({
          userId, market, side: "bid",
          price: String(currentPrice),
          volume: String(targetAmount / currentPrice),
          status: result.success ? "success" : "failed",
          message: result.success ? `볼린저 하단 매수: ${targetAmount.toLocaleString()}원 (수수료: ${feePaid.toFixed(0)}원)` : result.message,
          feePaid: result.success ? String(feePaid) : null,
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
      const orderValue = coinBalance * currentPrice;
      
      if (orderValue >= minOrderValue) {
        const feePaid = this.calculateFee(orderValue, settings);
        console.log(`[BOT ${userId}] Bollinger: Price ${currentPrice} >= Upper ${bands.upper.toFixed(0)} - SELL, fee: ${feePaid.toFixed(0)} KRW`);
        
        const result = await this.placeSellOrder(settings.upbitAccessKey, settings.upbitSecretKey, market, coinBalance);

        await this.storage.createTradeLog({
          userId, market, side: "ask",
          price: String(currentPrice),
          volume: String(coinBalance),
          status: result.success ? "success" : "failed",
          message: result.success ? `볼린저 상단 매도: ${coinBalance.toFixed(8)} ${coinSymbol} (수수료: ${feePaid.toFixed(0)}원)` : result.message,
          feePaid: result.success ? String(feePaid) : null,
        });

        if (result.success) {
          await this.storage.updateBotSettings(userId, { lastTradeTime: new Date() });
        }
      }
    }
  }

  // Calculate MACD - returns last valid values only
  private calculateMACD(prices: number[], shortPeriod: number = 12, longPeriod: number = 26, signalPeriod: number = 9) {
    if (prices.length < longPeriod + signalPeriod) {
      return { macdLine: [0], signalLine: [0], histogram: [0] };
    }
    const emaShort = this.calculateEMA(prices, shortPeriod);
    const emaLong = this.calculateEMA(prices, longPeriod);
    
    // MACD Line = EMA12 - EMA26 (calculated point by point)
    const macdLine: number[] = [];
    for (let i = 0; i < prices.length; i++) {
      macdLine.push(emaShort[i] - emaLong[i]);
    }
    
    // Signal Line = EMA9 of MACD Line
    const signalLine = this.calculateEMA(macdLine, signalPeriod);
    
    // Histogram = MACD Line - Signal Line
    const histogram: number[] = [];
    for (let i = 0; i < macdLine.length; i++) {
      histogram.push(macdLine[i] - signalLine[i]);
    }
    
    return { macdLine, signalLine, histogram };
  }

  private calculateEMA(prices: number[], period: number): number[] {
    const multiplier = 2 / (period + 1);
    const ema: number[] = [];
    for (let i = 0; i < prices.length; i++) {
      if (i === 0) {
        ema.push(prices[0]);
      } else {
        ema.push((prices[i] - ema[i - 1]) * multiplier + ema[i - 1]);
      }
    }
    return ema;
  }

  // Calculate Stochastic
  private calculateStochastic(candles: CandleData[], period: number = 14, smoothK: number = 3, smoothD: number = 3) {
    const kValues: number[] = [];
    for (let i = 0; i < candles.length; i++) {
      if (i < period - 1) {
        kValues.push(50);
        continue;
      }
      const slice = candles.slice(i - period + 1, i + 1);
      const high = Math.max(...slice.map(c => c.high));
      const low = Math.min(...slice.map(c => c.low));
      const close = candles[i].close;
      const k = high !== low ? ((close - low) / (high - low)) * 100 : 50;
      kValues.push(k);
    }
    const smoothedK = this.calculateSMAArray(kValues, smoothK);
    const smoothedD = this.calculateSMAArray(smoothedK, smoothD);
    return { k: smoothedK, d: smoothedD };
  }

  private calculateSMAArray(data: number[], period: number): number[] {
    const result: number[] = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        result.push(data[i]);
      } else {
        const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
        result.push(sum / period);
      }
    }
    return result;
  }

  // Calculate ATR (Average True Range) for volatility-based profitability checks
  private calculateATR(candles: CandleData[], period: number = 14): number {
    if (candles.length < period + 1) return 0;
    
    const trueRanges: number[] = [];
    for (let i = 1; i < candles.length; i++) {
      const high = candles[i].high;
      const low = candles[i].low;
      const prevClose = candles[i - 1].close;
      const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
      trueRanges.push(tr);
    }
    
    // Simple average of last 'period' true ranges
    const recentTRs = trueRanges.slice(-period);
    return recentTRs.reduce((a, b) => a + b, 0) / recentTRs.length;
  }

  // Calculate expected price movement potential as percentage
  private getExpectedMovePct(candles: CandleData[], currentPrice: number): number {
    const atr = this.calculateATR(candles, 14);
    return atr / currentPrice; // ATR as percentage of current price
  }

  // Backtest strategy with historical data
  async runBacktest(market: string, strategy: string, days: number = 30, params: {
    buyThreshold?: number;
    sellThreshold?: number;
    targetAmount?: number;
  } = {}): Promise<{
    totalTrades: number;
    winTrades: number;
    lossTrades: number;
    winRate: number;
    totalProfit: number;
    maxDrawdown: number;
    trades: { timestamp: number; side: string; price: number; profit?: number }[];
  }> {
    const count = Math.min(days * 24, 200); // Max 200 candles (hourly)
    let candles: CandleData[] = [];
    
    try {
      const res = await axios.get(`${this.baseUrl}/candles/minutes/60?market=${market}&count=${count}`);
      candles = res.data.map((c: any) => ({
        timestamp: new Date(c.candle_date_time_kst).getTime(),
        open: c.opening_price,
        high: c.high_price,
        low: c.low_price,
        close: c.trade_price,
        volume: c.candle_acc_trade_volume,
      })).reverse();
    } catch (e) {
      console.error("Backtest candle fetch failed:", e);
      return { totalTrades: 0, winTrades: 0, lossTrades: 0, winRate: 0, totalProfit: 0, maxDrawdown: 0, trades: [] };
    }

    const trades: { timestamp: number; side: string; price: number; profit?: number }[] = [];
    let position = 0;
    let entryPrice = 0;
    let balance = params.targetAmount || 100000;
    let peak = balance;
    let maxDrawdown = 0;
    let winTrades = 0;
    let lossTrades = 0;

    const buyThreshold = params.buyThreshold || 0.5;
    const sellThreshold = params.sellThreshold || 0.5;

    for (let i = 20; i < candles.length; i++) {
      const prices = candles.slice(0, i + 1).map(c => c.close);
      const currentPrice = prices[prices.length - 1];
      let signal: 'buy' | 'sell' | 'hold' = 'hold';

      // Generate signal based on strategy
      switch (strategy) {
        case 'percent': {
          if (i > 0) {
            const prevPrice = prices[prices.length - 2];
            const change = (currentPrice - prevPrice) / prevPrice * 100;
            if (change <= -buyThreshold) signal = 'buy';
            else if (change >= sellThreshold) signal = 'sell';
          }
          break;
        }
        case 'rsi': {
          const rsi = this.calculateRSI(prices, 14);
          if (rsi < 30) signal = 'buy';
          else if (rsi > 70) signal = 'sell';
          break;
        }
        case 'ma': {
          const shortMA = this.calculateSMA(prices, 5);
          const longMA = this.calculateSMA(prices, 20);
          const prevShortMA = this.calculateSMA(prices.slice(0, -1), 5);
          const prevLongMA = this.calculateSMA(prices.slice(0, -1), 20);
          if (prevShortMA <= prevLongMA && shortMA > longMA) signal = 'buy';
          else if (prevShortMA >= prevLongMA && shortMA < longMA) signal = 'sell';
          break;
        }
        case 'bollinger': {
          const bb = this.calculateBollingerBands(prices, 20, 2);
          if (currentPrice <= bb.lower) signal = 'buy';
          else if (currentPrice >= bb.upper) signal = 'sell';
          break;
        }
      }

      // Execute simulated trades
      if (signal === 'buy' && position === 0) {
        position = balance / currentPrice;
        entryPrice = currentPrice;
        trades.push({ timestamp: candles[i].timestamp, side: 'bid', price: currentPrice });
      } else if (signal === 'sell' && position > 0) {
        const exitValue = position * currentPrice;
        const profit = exitValue - (position * entryPrice);
        balance = exitValue;
        
        if (profit > 0) winTrades++;
        else lossTrades++;
        
        trades.push({ timestamp: candles[i].timestamp, side: 'ask', price: currentPrice, profit });
        position = 0;
        entryPrice = 0;
      }

      // Track drawdown
      const currentValue = position > 0 ? position * currentPrice : balance;
      if (currentValue > peak) peak = currentValue;
      const drawdown = (peak - currentValue) / peak * 100;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    // Close any remaining position at last price
    if (position > 0) {
      const lastPrice = candles[candles.length - 1].close;
      const exitValue = position * lastPrice;
      const profit = exitValue - (position * entryPrice);
      balance = exitValue;
      
      if (profit > 0) winTrades++;
      else lossTrades++;
      
      trades.push({ timestamp: candles[candles.length - 1].timestamp, side: 'ask', price: lastPrice, profit });
    }

    const initialBalance = params.targetAmount || 100000;
    const totalProfit = balance - initialBalance;
    const totalTrades = trades.length;

    return {
      totalTrades,
      winTrades,
      lossTrades,
      winRate: totalTrades > 0 ? (winTrades / (winTrades + lossTrades)) * 100 : 0,
      totalProfit,
      maxDrawdown,
      trades: trades.slice(-20), // Return last 20 trades
    };
  }

  // Get trading statistics
  async getStatistics(userId: string): Promise<{
    daily: { date: string; profit: number; trades: number }[];
    weekly: { week: string; profit: number; trades: number }[];
    monthly: { month: string; profit: number; trades: number }[];
    winRate: number;
    avgProfit: number;
    avgLoss: number;
    profitFactor: number;
    totalProfit: number;
    bestTrade: number;
    worstTrade: number;
  }> {
    const logs = await this.storage.getTradeLogs(userId);
    const successLogs = logs.filter(l => l.status === 'success');

    // Group by day/week/month
    const dailyMap = new Map<string, { profit: number; trades: number }>();
    const weeklyMap = new Map<string, { profit: number; trades: number }>();
    const monthlyMap = new Map<string, { profit: number; trades: number }>();

    let totalProfit = 0;
    let totalLoss = 0;
    let wins = 0;
    let losses = 0;
    let bestTrade = 0;
    let worstTrade = 0;

    // Match buys with sells to calculate individual trade profits
    const buyQueue: { price: number; volume: number; timestamp: Date }[] = [];
    
    for (const log of successLogs.sort((a, b) => new Date(a.timestamp!).getTime() - new Date(b.timestamp!).getTime())) {
      const price = parseFloat(String(log.price));
      const volume = parseFloat(String(log.volume));
      const timestamp = new Date(log.timestamp!);
      
      const dateKey = timestamp.toISOString().split('T')[0];
      const weekNum = Math.floor(timestamp.getTime() / (7 * 24 * 60 * 60 * 1000));
      const weekKey = `W${weekNum}`;
      const monthKey = `${timestamp.getFullYear()}-${String(timestamp.getMonth() + 1).padStart(2, '0')}`;

      if (log.side === 'bid') {
        buyQueue.push({ price, volume, timestamp });
      } else if (log.side === 'ask' && buyQueue.length > 0) {
        const buy = buyQueue.shift()!;
        const profit = (price - buy.price) * volume;
        
        if (profit > 0) {
          totalProfit += profit;
          wins++;
          if (profit > bestTrade) bestTrade = profit;
        } else {
          totalLoss += Math.abs(profit);
          losses++;
          if (profit < worstTrade) worstTrade = profit;
        }

        // Update daily
        if (!dailyMap.has(dateKey)) dailyMap.set(dateKey, { profit: 0, trades: 0 });
        const daily = dailyMap.get(dateKey)!;
        daily.profit += profit;
        daily.trades++;

        // Update weekly
        if (!weeklyMap.has(weekKey)) weeklyMap.set(weekKey, { profit: 0, trades: 0 });
        const weekly = weeklyMap.get(weekKey)!;
        weekly.profit += profit;
        weekly.trades++;

        // Update monthly
        if (!monthlyMap.has(monthKey)) monthlyMap.set(monthKey, { profit: 0, trades: 0 });
        const monthly = monthlyMap.get(monthKey)!;
        monthly.profit += profit;
        monthly.trades++;
      }
    }

    return {
      daily: Array.from(dailyMap.entries()).map(([date, data]) => ({ date, ...data })).slice(-30),
      weekly: Array.from(weeklyMap.entries()).map(([week, data]) => ({ week, ...data })).slice(-12),
      monthly: Array.from(monthlyMap.entries()).map(([month, data]) => ({ month, ...data })).slice(-12),
      winRate: (wins + losses) > 0 ? (wins / (wins + losses)) * 100 : 0,
      avgProfit: wins > 0 ? totalProfit / wins : 0,
      avgLoss: losses > 0 ? totalLoss / losses : 0,
      profitFactor: totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? 999 : 0,
      totalProfit: totalProfit - totalLoss,
      bestTrade,
      worstTrade,
    };
  }

  // Get advanced technical indicators for a market
  async getAdvancedIndicators(market: string): Promise<{
    macd: { line: number; signal: number; histogram: number };
    stochastic: { k: number; d: number };
    rsi: number;
    sma5: number;
    sma20: number;
    ema12: number;
    ema26: number;
    bb: { upper: number; middle: number; lower: number };
  }> {
    const candles = await this.getCandles(market, 60);
    if (candles.length < 26) {
      return {
        macd: { line: 0, signal: 0, histogram: 0 },
        stochastic: { k: 50, d: 50 },
        rsi: 50,
        sma5: 0,
        sma20: 0,
        ema12: 0,
        ema26: 0,
        bb: { upper: 0, middle: 0, lower: 0 },
      };
    }

    const prices = candles.map(c => c.close);
    const { macdLine, signalLine, histogram } = this.calculateMACD(prices);
    const stoch = this.calculateStochastic(candles);
    const rsi = this.calculateRSI(prices, 14);
    const sma5 = this.calculateSMA(prices, 5);
    const sma20 = this.calculateSMA(prices, 20);
    const ema = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    const bb = this.calculateBollingerBands(prices, 20, 2);

    return {
      macd: {
        line: macdLine[macdLine.length - 1],
        signal: signalLine[signalLine.length - 1],
        histogram: histogram[histogram.length - 1],
      },
      stochastic: {
        k: stoch.k[stoch.k.length - 1],
        d: stoch.d[stoch.d.length - 1],
      },
      rsi,
      sma5,
      sma20,
      ema12: ema[ema.length - 1],
      ema26: ema26[ema26.length - 1],
      bb,
    };
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
          const baseTargetAmount = parseFloat(settings.targetAmount || "10000");
          
          // Validate base target amount
          if (isNaN(baseTargetAmount) || baseTargetAmount <= 0) {
            console.warn(`[BOT] Invalid targetAmount for user ${settings.userId}, skipping`);
            continue;
          }
          
          // Parse and validate portfolio markets
          const portfolioMarkets = settings.portfolioMarkets 
            ? settings.portfolioMarkets.split(',').map(m => m.trim()).filter(Boolean) 
            : [];
          const portfolioAllocationsRaw = settings.portfolioAllocations 
            ? settings.portfolioAllocations.split(',').map(a => parseFloat(a.trim())).filter(n => !isNaN(n) && n > 0) 
            : [];
          
          // Build markets to trade with validated allocations
          let marketsToTrade: Array<{ market: string; allocation: number }>;
          
          if (portfolioMarkets.length > 0 && portfolioAllocationsRaw.length === portfolioMarkets.length) {
            // Normalize allocations to sum to 100
            const rawSum = portfolioAllocationsRaw.reduce((sum, a) => sum + a, 0);
            const normalizedAllocations = rawSum > 0 
              ? portfolioAllocationsRaw.map(a => (a / rawSum) * 100)
              : portfolioAllocationsRaw.map(() => 100 / portfolioMarkets.length);
            
            marketsToTrade = portfolioMarkets.map((market, idx) => ({
              market,
              allocation: normalizedAllocations[idx],
            }));
          } else if (portfolioMarkets.length > 0) {
            // Equal allocation for all markets if allocations mismatch
            const equalAllocation = 100 / portfolioMarkets.length;
            marketsToTrade = portfolioMarkets.map(market => ({
              market,
              allocation: equalAllocation,
            }));
          } else {
            // Single market mode
            marketsToTrade = [{ market: settings.market, allocation: 100 }];
          }
          
          // Execute strategy for each market with immutable settings copy
          for (const { market, allocation } of marketsToTrade) {
            const calculatedAmount = Math.floor(baseTargetAmount * allocation / 100);
            
            // Skip if calculated amount is too small (less than 5000 KRW minimum order)
            if (calculatedAmount < 5000) {
              console.warn(`[BOT] Calculated amount ${calculatedAmount} for ${market} is below minimum, skipping`);
              continue;
            }
            
            // Create mutable settings copy for this market with all required fields
            // Strategy executors need to update referencePrice/lastTradeTime
            const marketSettings = {
              id: settings.id,
              userId: settings.userId,
              market: market,
              isActive: settings.isActive,
              strategy: settings.strategy,
              buyThreshold: settings.buyThreshold,
              sellThreshold: settings.sellThreshold,
              targetAmount: String(calculatedAmount),
              upbitAccessKey: settings.upbitAccessKey,
              upbitSecretKey: settings.upbitSecretKey,
              referencePrice: settings.referencePrice,
              lastTradeTime: settings.lastTradeTime,
              stopLossPercent: settings.stopLossPercent,
              takeProfitPercent: settings.takeProfitPercent,
              trailingStopEnabled: settings.trailingStopEnabled,
              trailingStopPercent: settings.trailingStopPercent,
              splitSellEnabled: settings.splitSellEnabled,
              splitSellPercents: settings.splitSellPercents,
              portfolioMarkets: settings.portfolioMarkets,
              portfolioAllocations: settings.portfolioAllocations,
              feeRate: settings.feeRate,
            };

            switch (strategy) {
              case "percent":
                await this.executePercentStrategy(marketSettings);
                break;
              case "dca":
                await this.executeDCAStrategy(marketSettings);
                break;
              case "grid":
                await this.executeGridStrategy(marketSettings);
                break;
              case "rsi":
                await this.executeRSIStrategy(marketSettings);
                break;
              case "ma":
                await this.executeMAStrategy(marketSettings);
                break;
              case "bollinger":
                await this.executeBollingerStrategy(marketSettings);
                break;
            }
          }
        }
      } catch (e) {
        console.error("[BOT] Error in trading loop:", e);
      }
    }, 10000); // Check every 10 seconds
  }
}
