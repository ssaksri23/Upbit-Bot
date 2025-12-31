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

export function useUpbitStatus() {
  return useQuery({
    queryKey: [api.upbit.status.path],
    queryFn: async () => {
      const res = await fetch(api.upbit.status.path, { credentials: "include" });
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
