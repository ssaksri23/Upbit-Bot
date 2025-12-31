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

    return jwt.sign(payload, secretKey, { algorithm: 'HS256' });
  }

  async getMarkets(): Promise<{ market: string; korean_name: string; english_name: string }[]> {
    try {
      const res = await axios.get(`${this.baseUrl}/market/all?isDetails=false`);
      // Filter only KRW markets
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
        // Suppress repeated error logging for status polling
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
      console.error("Status:", e.response?.status);
      const errorName = e.response?.data?.error?.name;
      const errorMsg = e.response?.data?.error?.message;
      
      if (errorName === "invalid_access_key") {
        return { success: false, message: "Access Key가 올바르지 않습니다. 키를 다시 확인해주세요." };
      } else if (errorName === "jwt_verification") {
        return { success: false, message: "Secret Key가 올바르지 않습니다. 키를 다시 확인해주세요." };
      } else if (errorName === "no_authorization_ip") {
        return { success: false, message: "IP 주소가 허용되지 않습니다. Upbit에서 API 키 설정을 '모든 IP 허용'으로 변경해주세요." };
      } else if (e.response?.status === 401) {
        return { success: false, message: "API 키 인증 실패. Access Key와 Secret Key를 다시 확인해주세요." };
      }
      
      return { 
        success: false, 
        message: errorMsg || "API 연결에 실패했습니다. 잠시 후 다시 시도해주세요." 
      };
    }
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
