## Packages
recharts | For visualizing price history and market data
framer-motion | For smooth page transitions and micro-interactions
clsx | For conditional class merging
tailwind-merge | For merging tailwind classes intelligently

## Notes
Tailwind Config - extend fontFamily:
fontFamily: {
  sans: ["'Plus Jakarta Sans'", "sans-serif"],
  mono: ["'JetBrains Mono'", "monospace"],
}
Dashboard needs to poll /api/upbit/status every 2 seconds.
Trade logs are fetched from /api/logs.
