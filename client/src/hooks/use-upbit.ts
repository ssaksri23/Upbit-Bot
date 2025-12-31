import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { InsertBotSettings } from "@shared/schema";

export function useMarkets() {
  return useQuery({
    queryKey: [api.upbit.markets.path],
    queryFn: async () => {
      const res = await fetch(api.upbit.markets.path);
      if (!res.ok) throw new Error("Failed to fetch markets");
      return api.upbit.markets.responses[200].parse(await res.json());
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}

export function useCandles(market: string, count: number = 60) {
  return useQuery({
    queryKey: [api.upbit.candles.path, market, count],
    queryFn: async () => {
      const res = await fetch(`${api.upbit.candles.path}?market=${encodeURIComponent(market)}&count=${count}`);
      if (!res.ok) throw new Error("Failed to fetch candles");
      return api.upbit.candles.responses[200].parse(await res.json());
    },
    refetchInterval: 5000, // Refresh every 5 seconds
  });
}

export function useRecommendations() {
  return useQuery({
    queryKey: [api.upbit.recommendations.path],
    queryFn: async () => {
      const res = await fetch(api.upbit.recommendations.path);
      if (!res.ok) throw new Error("Failed to fetch recommendations");
      return api.upbit.recommendations.responses[200].parse(await res.json());
    },
    refetchInterval: 60000, // Refresh every 60 seconds
    staleTime: 30000, // Consider stale after 30 seconds
  });
}

export function useUpbitStatus(market?: string) {
  return useQuery({
    queryKey: [api.upbit.status.path, market],
    queryFn: async () => {
      const url = market 
        ? `${api.upbit.status.path}?market=${encodeURIComponent(market)}`
        : api.upbit.status.path;
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed to fetch status");
      return api.upbit.status.responses[200].parse(await res.json());
    },
    refetchInterval: 2000, // Poll every 2 seconds
  });
}

export function useBotSettings() {
  return useQuery({
    queryKey: [api.upbit.settings.get.path],
    queryFn: async () => {
      const res = await fetch(api.upbit.settings.get.path, { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed to fetch settings");
      return api.upbit.settings.get.responses[200].parse(await res.json());
    },
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: Partial<InsertBotSettings> & { upbitAccessKey?: string; upbitSecretKey?: string }) => {
      const res = await fetch(api.upbit.settings.update.path, {
        method: api.upbit.settings.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update settings");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.upbit.settings.get.path] });
      queryClient.invalidateQueries({ queryKey: [api.upbit.status.path] });
      toast({
        title: t("settings.saved"),
        description: t("settings.savedDesc"),
      });
    },
    onError: () => {
      toast({
        title: t("settings.error"),
        description: t("settings.errorDesc"),
        variant: "destructive",
      });
    },
  });
}

export function useVerifyApiKeys() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/upbit/verify", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to verify");
      return res.json() as Promise<{ success: boolean; message: string }>;
    },
    onSuccess: (data) => {
      toast({
        title: data.success ? t("settings.verifySuccess") : t("settings.verifyFailed"),
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: () => {
      toast({
        title: t("settings.error"),
        description: t("settings.errorDesc"),
        variant: "destructive",
      });
    },
  });
}

export function useTradeLogs() {
  return useQuery({
    queryKey: [api.logs.list.path],
    queryFn: async () => {
      const res = await fetch(api.logs.list.path, { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed to fetch logs");
      return api.logs.list.responses[200].parse(await res.json());
    },
    refetchInterval: 5000,
  });
}

export function useManualBuy() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ market, amount }: { market: string; amount: number }) => {
      const res = await fetch(api.upbit.trade.buy.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ market, amount }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to buy");
      return res.json() as Promise<{ success: boolean; message: string }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.upbit.status.path] });
      queryClient.invalidateQueries({ queryKey: [api.logs.list.path] });
      toast({
        title: data.success ? "매수 완료" : "매수 실패",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: () => {
      toast({
        title: "오류",
        description: "매수 중 오류가 발생했습니다",
        variant: "destructive",
      });
    },
  });
}

export function useManualSell() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ market }: { market: string }) => {
      const res = await fetch(api.upbit.trade.sell.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ market }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to sell");
      return res.json() as Promise<{ success: boolean; message: string }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.upbit.status.path] });
      queryClient.invalidateQueries({ queryKey: [api.logs.list.path] });
      toast({
        title: data.success ? "매도 완료" : "매도 실패",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: () => {
      toast({
        title: "오류",
        description: "매도 중 오류가 발생했습니다",
        variant: "destructive",
      });
    },
  });
}

export function useBacktest() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: { 
      market: string; 
      strategy: string; 
      days?: number; 
      buyThreshold?: number; 
      sellThreshold?: number;
      targetAmount?: number;
    }) => {
      const res = await fetch("/api/upbit/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to backtest");
      return res.json() as Promise<{
        totalTrades: number;
        winTrades: number;
        lossTrades: number;
        winRate: number;
        totalProfit: number;
        maxDrawdown: number;
        trades: { timestamp: number; side: string; price: number; profit?: number }[];
      }>;
    },
    onError: () => {
      toast({
        title: "백테스트 실패",
        description: "백테스트 중 오류가 발생했습니다",
        variant: "destructive",
      });
    },
  });
}

export function useStatistics() {
  return useQuery({
    queryKey: ["/api/upbit/statistics"],
    queryFn: async () => {
      const res = await fetch("/api/upbit/statistics", { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed to fetch statistics");
      return res.json() as Promise<{
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
      }>;
    },
    refetchInterval: 30000,
  });
}

export function useIndicators(market: string) {
  return useQuery({
    queryKey: ["/api/upbit/indicators", market],
    queryFn: async () => {
      const res = await fetch(`/api/upbit/indicators?market=${encodeURIComponent(market)}`, { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed to fetch indicators");
      return res.json() as Promise<{
        macd: { line: number; signal: number; histogram: number };
        stochastic: { k: number; d: number };
        rsi: number;
        sma5: number;
        sma20: number;
        ema12: number;
        ema26: number;
        bb: { upper: number; middle: number; lower: number };
      }>;
    },
    refetchInterval: 5000,
  });
}
