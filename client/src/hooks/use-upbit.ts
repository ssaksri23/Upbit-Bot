import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type InsertBotSettings } from "@shared/routes";

// ============================================
// STATUS & SETTINGS HOOKS
// ============================================

// GET /api/upbit/status - Polling enabled
export function useUpbitStatus() {
  return useQuery({
    queryKey: [api.upbit.status.path],
    queryFn: async () => {
      const res = await fetch(api.upbit.status.path);
      if (!res.ok) throw new Error("Failed to fetch status");
      return api.upbit.status.responses[200].parse(await res.json());
    },
    refetchInterval: 2000, // Poll every 2 seconds
  });
}

// GET /api/upbit/settings
export function useBotSettings() {
  return useQuery({
    queryKey: [api.upbit.settings.get.path],
    queryFn: async () => {
      const res = await fetch(api.upbit.settings.get.path);
      if (!res.ok) throw new Error("Failed to fetch settings");
      return api.upbit.settings.get.responses[200].parse(await res.json());
    },
  });
}

// POST /api/upbit/settings - Update settings
export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<InsertBotSettings>) => {
      const res = await fetch(api.upbit.settings.update.path, {
        method: api.upbit.settings.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update settings");
      return api.upbit.settings.update.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.upbit.settings.get.path] });
    },
  });
}

// POST /api/upbit/toggle - Toggle Bot Active/Inactive
export function useToggleBot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (isActive: boolean) => {
      const res = await fetch(api.upbit.toggle.path, {
        method: api.upbit.toggle.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error("Failed to toggle bot");
      return api.upbit.toggle.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.upbit.status.path] });
      queryClient.invalidateQueries({ queryKey: [api.upbit.settings.get.path] });
    },
  });
}

// ============================================
// TRADE LOGS HOOKS
// ============================================

// GET /api/logs
export function useTradeLogs() {
  return useQuery({
    queryKey: [api.logs.list.path],
    queryFn: async () => {
      const res = await fetch(api.logs.list.path);
      if (!res.ok) throw new Error("Failed to fetch trade logs");
      return api.logs.list.responses[200].parse(await res.json());
    },
    refetchInterval: 5000, // Refresh logs every 5s
  });
}
