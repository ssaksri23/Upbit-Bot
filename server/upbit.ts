import axios from "axios";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import { IStorage } from "./storage";
import { BotSettings } from "@shared/schema";

export class UpbitService {
  private storage: IStorage;
  private baseUrl = "https://api.upbit.com/v1";

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

    return jwt.sign(payload, secretKey);
  }

  async getStatus(userId: string) {
    const settings = await this.storage.getBotSettings(userId);
    const market = settings?.market || "KRW-BTC";
    
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
      } catch (e) {
        console.error("Failed to fetch accounts:", e);
      }
    }

    return {
      market,
      currentPrice,
      balanceKRW,
      balanceCoin,
      isActive: settings?.isActive || false,
    };
  }

  startLoop() {
    setInterval(async () => {
      const activeSettings = await this.storage.getAllActiveSettings();
      
      for (const settings of activeSettings) {
        if (!settings.upbitAccessKey || !settings.upbitSecretKey) continue;
        
        // This is where the trading logic would go for each user
      }
    }, 10000); // Run every 10 seconds
  }
}
