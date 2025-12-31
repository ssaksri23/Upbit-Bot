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
    register: {
      method: 'POST' as const,
      path: '/api/auth/register',
      input: z.object({
        email: z.string().email(),
        password: z.string().min(6),
        displayName: z.string().optional(),
      }),
      responses: {
        200: z.object({ success: z.boolean() }),
        400: errorSchemas.validation,
      },
    },
    login: {
      method: 'POST' as const,
      path: '/api/auth/login',
      input: z.object({
        email: z.string().email(),
        password: z.string(),
      }),
      responses: {
        200: z.object({ success: z.boolean() }),
        401: errorSchemas.unauthorized,
      },
    },
    me: {
      method: 'GET' as const,
      path: '/api/auth/me',
      responses: {
        200: z.object({
          id: z.string(),
          email: z.string(),
          displayName: z.string().optional().nullable(),
        }).nullable(),
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
    markets: {
      method: 'GET' as const,
      path: '/api/upbit/markets',
      responses: {
        200: z.array(z.object({
          market: z.string(),
          korean_name: z.string(),
          english_name: z.string(),
        })),
      },
    },
    status: {
      method: 'GET' as const,
      path: '/api/upbit/status',
      responses: {
        200: z.object({
          market: z.string(),
          currentPrice: z.number(),
          balanceKRW: z.number(),
          balanceCoin: z.number(),
          totalAssetKRW: z.number(),
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
            strategy: z.string(),
            buyThreshold: z.string(),
            sellThreshold: z.string(),
            targetAmount: z.string(),
            hasAccessKey: z.boolean(),
            hasSecretKey: z.boolean(),
          }),
          401: errorSchemas.unauthorized,
        },
      },
      update: {
        method: 'POST' as const,
        path: '/api/upbit/settings',
        input: insertBotSettingsSchema.partial().omit({ userId: true }),
        responses: {
          200: z.object({ success: z.boolean() }),
          401: errorSchemas.unauthorized,
        },
      },
      verify: {
        method: 'POST' as const,
        path: '/api/upbit/verify',
        responses: {
          200: z.object({ success: z.boolean(), message: z.string() }),
          401: errorSchemas.unauthorized,
        },
      },
    },
    candles: {
      method: 'GET' as const,
      path: '/api/upbit/candles',
      responses: {
        200: z.array(z.object({
          timestamp: z.number(),
          open: z.number(),
          high: z.number(),
          low: z.number(),
          close: z.number(),
          volume: z.number().optional(),
        })),
      },
    },
    trade: {
      buy: {
        method: 'POST' as const,
        path: '/api/upbit/buy',
        input: z.object({
          market: z.string(),
          amount: z.number(),
        }),
        responses: {
          200: z.object({ success: z.boolean(), message: z.string() }),
          401: errorSchemas.unauthorized,
        },
      },
      sell: {
        method: 'POST' as const,
        path: '/api/upbit/sell',
        input: z.object({
          market: z.string(),
        }),
        responses: {
          200: z.object({ success: z.boolean(), message: z.string() }),
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
