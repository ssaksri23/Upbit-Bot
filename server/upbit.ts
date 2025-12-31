import axios from "axios";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import { IStorage } from "./storage";

export class UpbitService {
  private storage: IStorage;
  private accessKey: string;
  private secretKey: string;
  private baseUrl = "https://api.upbit.com/v1";

  constructor(storage: IStorage) {
    this.storage = storage;
    this.accessKey = process.env.UPBIT_ACCESS_KEY || "";
    this.secretKey = process.env.UPBIT_SECRET_KEY || "";
  }

  private getAuthToken(query?: string) {
    if (!this.accessKey || !this.secretKey) return null;

    const payload: any = {
      access_key: this.accessKey,
      nonce: uuidv4(),
    };

    if (query) {
      const hash = crypto.createHash("sha512");
      const queryHash = hash.update(query, "utf-8").digest("hex");
      payload.query_hash = queryHash;
      payload.query_hash_alg = "SHA512";
    }

    return jwt.sign(payload, this.secretKey);
  }

  async getStatus() {
    const settings = await this.storage.getBotSettings();
    const market = settings?.market || "KRW-BTC";
    
    // Fetch Current Price (Public API)
    let currentPrice = 0;
    try {
      const tickerRes = await axios.get(`${this.baseUrl}/ticker?markets=${market}`);
      currentPrice = tickerRes.data[0].trade_price;
    } catch (e) {
      console.error("Failed to fetch price:", e);
    }

    // Fetch Balance (Private API) - Mock if no keys
    let balanceKRW = 0;
    let balanceCoin = 0;

    if (this.accessKey && this.secretKey) {
      try {
        const token = this.getAuthToken();
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
    } else {
      // Mock balances for demonstration
      balanceKRW = 1000000; 
      balanceCoin = 0.05;
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
      const settings = await this.storage.getBotSettings();
      if (!settings?.isActive) return;

      // Simple mock strategy: 
      // In a real bot, you would track price history or indicators here.
      // For this MVP, we just log that we are "monitoring".
      
      // Example logic placeholder:
      // const price = await this.getCurrentPrice(settings.market);
      // if (price < target) buy();
      
      // We can add a "heartbeat" log every minute just to show it's alive in the DB
      // await this.storage.createTradeLog({
      //   market: settings.market,
      //   side: 'info',
      //   price: '0',
      //   volume: '0',
      //   status: 'success',
      //   message: 'Bot monitoring...'
      // });

    }, 10000); // Run every 10 seconds
  }
}
