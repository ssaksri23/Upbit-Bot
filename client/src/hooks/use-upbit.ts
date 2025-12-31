import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { InsertBotSettings } from "@shared/schema";

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
        title: "Settings Saved",
        description: "Your bot configuration has been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
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
