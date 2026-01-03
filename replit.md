# Upbit AutoBot

## Overview

Upbit AutoBot is a cryptocurrency trading automation platform that connects to the Upbit exchange (Korean crypto exchange). The application provides a dashboard for monitoring real-time prices, managing trading bot settings, and viewing trade execution logs. Users can configure automated trading strategies with customizable buy/sell thresholds and target amounts.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state caching and synchronization
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom dark theme optimized for trading dashboards
- **Internationalization**: i18next with English/Korean language support
- **Animations**: Framer Motion for smooth UI transitions
- **Charts**: Recharts for price visualization

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ESM modules
- **Build Tool**: esbuild for server bundling, Vite for client bundling
- **API Pattern**: RESTful endpoints defined in `shared/routes.ts` with Zod schema validation

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Session Storage**: PostgreSQL-backed sessions via connect-pg-simple
- **Schema Location**: `shared/schema.ts` defines users, trade logs, and bot settings tables

### Authentication
- **Method**: Session-based authentication with bcrypt password hashing
- **Session Management**: Express sessions stored in PostgreSQL
- **Routes**: Custom email/password auth at `/api/auth/login`, `/api/auth/register`, `/api/auth/me`
- **Note**: There's also Replit Auth integration code present in `server/replit_integrations/auth/` but the main app uses custom auth

### Key Design Patterns
- **Shared Types**: Schema definitions in `shared/` are shared between client and server
- **API Contracts**: Route definitions with Zod schemas ensure type safety across boundaries
- **Polling**: Dashboard polls `/api/upbit/status` every 2 seconds for real-time updates
- **Storage Abstraction**: `IStorage` interface in `server/storage.ts` abstracts database operations

### Multi-Coin Portfolio Trading
- **Feature**: Users can select multiple coins with percentage allocation
- **Storage**: `portfolioMarkets` (comma-separated markets) and `portfolioAllocations` (comma-separated percentages)
- **Execution**: Bot distributes `targetAmount` across markets based on allocation percentages
- **Minimum Order**: Each market allocation must be at least 5000 KRW (Upbit minimum)
- **Known Limitation**: Trading state (referencePrice, lastTradeTime) is shared per user, not per market. This means:
  - The cooldown timer applies across all coins
  - Price reference is shared (not optimal for independent coin strategies)
  - Future improvement: Implement per-market state storage for better multi-coin support

### Fee-Aware Trading (2026-01-02)
- **Fee Rate**: Upbit charges 0.05% per trade (buy or sell), configurable via `feeRate` in bot settings
- **Fee Buffer**: Round-trip fee + slippage margin ≈ 0.15% (buy fee + sell fee + buffer)
- **Strategy Adjustments**:
  - **Percent/Grid**: Hard threshold adjustment - only trade when price change > fee buffer (prevents unprofitable trades)
  - **Bollinger**: Skips trades when band width is too narrow for profitability
  - **RSI/MA**: Trust technical signals - fees are logged but trades execute (crossovers/RSI extremes are strong signals)
  - **DCA**: Skip only if price is significantly above average (>0.45% above 10-period avg)
- **Trade Log**: Each successful trade records `feePaid` in KRW
- **UI Display**: Dashboard shows per-trade fee and cumulative fees in the trades table
- **Helper Functions** in `server/upbit.ts`:
  - `getFeeRate(settings)`: Returns fee rate (default 0.0005 = 0.05%)
  - `getFeeBuffer(settings)`: Returns minimum profitable price change (~0.15%)
  - `calculateFee(amount, settings)`: Calculates fee for given trade amount

### Stop-Loss / Take-Profit Automation (2026-01-03)
- **Stop-Loss**: Automatically sells when price drops below entry price by configured percentage (default: -5%)
- **Take-Profit**: Automatically sells when price rises above entry price by configured percentage (default: +10%)
- **Entry Price Tracking**: Uses `referencePrice` field to track the price at which user bought
- **Priority**: Stop-loss/take-profit checks run BEFORE regular strategy execution
- **UI Settings**: Users can configure stop-loss % and take-profit % in SettingsForm
- **Trade Log**: Records "손절 매도" or "익절 매도" with percentage change

## External Dependencies

### Third-Party APIs
- **Upbit API**: Korean cryptocurrency exchange API for:
  - Market price data (`/v1/ticker`)
  - Account balances (`/v1/accounts`)
  - Trade execution (buy/sell orders)
  - Authentication uses JWT tokens signed with user-provided API keys

### Database
- **PostgreSQL**: Primary data store (requires `DATABASE_URL` environment variable)
- **Drizzle ORM**: Database migrations in `./migrations` directory, push with `npm run db:push`

### Environment Variables Required
- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Secret for session signing

### Key NPM Dependencies
- `drizzle-orm` / `drizzle-kit`: Database ORM and migrations
- `express-session` / `connect-pg-simple`: Session management
- `bcrypt`: Password hashing
- `jsonwebtoken`: JWT creation for Upbit API auth
- `axios`: HTTP client for Upbit API calls
- `zod`: Runtime type validation