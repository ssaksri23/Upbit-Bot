import { z } from 'zod';
import { insertBotSettingsSchema, tradeLogs } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
};

export const api = {
  auth: {
    me: {
      method: 'GET' as const,
      path: '/api/auth/me',
      responses: {
        200: z.object({
          id: z.number(),
          username: z.string(),
          displayName: z.string().optional().nullable(),
        }).nullable(), // Returns null if not logged in
      },
    },
    logout: {
      method: 'POST' as const,
      path: '/api/auth/logout',
      responses: {
        200: z.object({ success: z.boolean() }),
      },
    },
  },
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
        401: errorSchemas.unauthorized,
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
            hasAccessKey: z.boolean(), // Don't return the actual key
            hasSecretKey: z.boolean(), // Don't return the actual key
          }),
          401: errorSchemas.unauthorized,
        },
      },
      update: {
        method: 'POST' as const,
        path: '/api/upbit/settings',
        // Allow partial updates, including keys
        input: insertBotSettingsSchema.partial().omit({ userId: true }),
        responses: {
          200: z.object({ success: z.boolean() }),
          401: errorSchemas.unauthorized,
        },
      },
    },
  },
  logs: {
    list: {
      method: 'GET' as const,
      path: '/api/logs',
      responses: {
        200: z.array(z.custom<typeof tradeLogs.$inferSelect>()),
        401: errorSchemas.unauthorized,
      },
    },
  },
};

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
