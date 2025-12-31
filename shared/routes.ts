import { z } from 'zod';
import { insertBotSettingsSchema, tradeLogs } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  upbit: {
    status: {
      method: 'GET' as const,
      path: '/api/upbit/status',
      responses: {
        200: z.object({
          market: z.string(),
          currentPrice: z.number(),
          balanceKRW: z.number(),
          balanceCoin: z.number(),
          isActive: z.boolean(),
        }),
      },
    },
    settings: {
      get: {
        method: 'GET' as const,
        path: '/api/upbit/settings',
        responses: {
          200: z.object({
            isActive: z.boolean(),
            market: z.string(),
            buyThreshold: z.string(),
            sellThreshold: z.string(),
            targetAmount: z.string(),
          }),
        },
      },
      update: {
        method: 'POST' as const,
        path: '/api/upbit/settings',
        input: insertBotSettingsSchema.partial(),
        responses: {
          200: z.object({ success: z.boolean() }),
        },
      },
    },
    toggle: {
      method: 'POST' as const,
      path: '/api/upbit/toggle',
      input: z.object({ isActive: z.boolean() }),
      responses: {
        200: z.object({ success: z.boolean(), isActive: z.boolean() }),
      },
    },
  },
  logs: {
    list: {
      method: 'GET' as const,
      path: '/api/logs',
      responses: {
        200: z.array(z.custom<typeof tradeLogs.$inferSelect>()),
      },
    },
  },
};

// Required buildUrl function
export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
