# TiaraStack Monorepo

A comprehensive monorepo containing tools for Google Sheets integration, Discord bot automation, and real-time collaborative applications.

## Overview

TiaraStack is a collection of interconnected services designed to provide seamless integration between Google Sheets, Discord, and web applications. The architecture follows a service-oriented design with clear separation of concerns.

## Architecture

```mermaid
flowchart TB
    subgraph Clients["Client Applications"]
        Web["sheet-web<br/>TanStack Start Dashboard"]
        SheetBot["sheet-bot<br/>Discord Bot"]
        VibeCord["vibecord<br/>Workspace Bot"]
        Formulas["sheet-formulas<br/>Apps Script"]
    end

    subgraph API_Layer["API Layer"]
        SheetAPIs["sheet-apis<br/>HTTP API Server"]
        Auth["sheet-auth<br/>Auth Service"]
    end

    subgraph Data_Layer["Data & Sync Layer"]
        DBServer["sheet-db-server<br/>Zero Sync Server"]
        Schema["sheet-db-schema<br/>Drizzle ORM Schema"]
    end

    subgraph Infrastructure["Infrastructure"]
        Core["typhoon-core<br/>Shared Utilities & Zero Integration"]
        DFX["dfx-discord-utils<br/>Discord Utils"]
        Atom["start-atom<br/>SSR State Management"]
        GAS["effect-platform-apps-script<br/>GAS HTTP Client"]
    end

    subgraph External["External Services"]
        GoogleSheets["Google Sheets API"]
        Discord["Discord API"]
        Postgres[("PostgreSQL")]
        SQLite[("SQLite")]
    end

    Web -->|"HTTP / Auth"| Auth
    Web -->|"API Calls"| SheetAPIs
    Web -.->|"SSR State"| Atom

    SheetBot -->|"HTTP API"| SheetAPIs
    SheetBot -->|"Gateway"| Discord
    SheetBot -.->|"Discord Utils"| DFX

    VibeCord -->|"SQLite"| SQLite
    VibeCord -->|"Gateway"| Discord

    Formulas -->|"Apps Script"| GoogleSheets
    Formulas -.->|"HTTP Client"| GAS
    Formulas -->|"API Calls"| SheetAPIs

    SheetAPIs -->|"Zero Protocol"| DBServer
    SheetAPIs -->|"Google API"| GoogleSheets
    SheetAPIs -.->|"Uses"| Core

    Auth -->|"Discord OAuth"| Discord
    Auth -->|"Auth Tables"| Postgres

    DBServer -->|"Queries"| Postgres
    DBServer -->|"Schema"| Schema
    DBServer -.->|"Uses"| Core

    Schema -.->|"Uses"| Core
```



## Package Structure

### Core Infrastructure


| Package                       | Description                                        | Tech Stack               |
| ----------------------------- | -------------------------------------------------- | ------------------------ |
| `typhoon-core`                | Shared utilities, Zero integration, schema helpers | Effect.ts, Rocicorp Zero |
| `bob`                         | Type-safe configuration builder                    | Standard Schema          |
| `dfx-discord-utils`           | Discord Effect utilities                           | dfx, unstorage           |
| `effect-platform-apps-script` | Effect HTTP client for Apps Script                 | Effect Platform          |
| `start-atom`                  | TanStack Start + Effect Atom integration           | Effect Atom              |


### Application Services


| Package           | Description                               | Tech Stack                            |
| ----------------- | ----------------------------------------- | ------------------------------------- |
| `sheet-apis`      | Main HTTP API server for sheet operations | Effect.ts, HttpApiBuilder, Playwright |
| `sheet-db-server` | Real-time sync database server            | Rocicorp Zero, Drizzle ORM            |
| `sheet-auth`      | Authentication service with Discord OAuth | Better Auth, Hono, Drizzle ORM        |
| `sheet-web`       | Web dashboard for guild management        | TanStack Start, React, shadcn/ui      |
| `sheet-bot`       | Discord bot for sheet integration         | dfx, Effect.ts, Handlebars            |
| `vibecord`        | Workspace/session management bot          | discord.js, SQLite, @opencode-ai/sdk  |


### Data & Integration


| Package           | Description                             | Tech Stack                    |
| ----------------- | --------------------------------------- | ----------------------------- |
| `sheet-db-schema` | PostgreSQL schema with Zero integration | Drizzle ORM, drizzle-zero     |
| `sheet-formulas`  | Google Apps Script formulas library     | Effect.ts, Google Apps Script |


## Service Interactions

### Request Flow

```mermaid
sequenceDiagram
    participant Web as sheet-web
    participant Bot as sheet-bot
    participant APIs as sheet-apis
    participant Auth as sheet-auth
    participant DB as sheet-db-server
    participant Google as Google Sheets
    participant Discord as Discord API
    participant Postgres as PostgreSQL

    Web->>Auth: Discord OAuth Login
    Auth->>Discord: OAuth Flow
    Auth-->>Web: JWT Token

    Web->>APIs: API Request + Token
    APIs->>Auth: Validate Token
    Auth-->>APIs: User Info

    APIs->>DB: Query/Mutate (Zero Protocol)
    DB->>Postgres: SQL Operations
    DB-->>APIs: Real-time Data

    APIs->>Google: Sheets API Operations
    Google-->>APIs: Sheet Data

    APIs-->>Web: Response

    Bot->>Discord: Gateway Events
    Bot->>APIs: HTTP API Calls
    APIs-->>Bot: Response Data
    Bot->>Discord: Send Messages
```



### Data Flow

1. **Web Application** (`sheet-web`)
  - Authenticates via `sheet-auth` using Discord OAuth
  - Makes API calls to `sheet-apis` for sheet operations
  - Uses `start-atom` for SSR-compatible state management
2. **Discord Bot** (`sheet-bot`)
  - Receives commands via Discord Gateway
  - Calls `sheet-apis` for backend operations
  - Uses `dfx-discord-utils` for caching and command building
  - Manages guild configurations and check-ins
3. **API Server** (`sheet-apis`)
  - Handles HTTP requests from web and bot clients
  - Integrates with Google Sheets via @googleapis/sheets and Playwright
  - Queries PostgreSQL via `sheet-db-server` using Zero protocol
  - Provides OpenTelemetry metrics and tracing
4. **Database Server** (`sheet-db-server`)
  - Provides real-time sync using Rocicorp Zero
  - Manages PostgreSQL schema via Drizzle ORM
  - Handles query and mutation requests
5. **VibeCord Bot** (`vibecord`)
  - Standalone Discord bot with SQLite database
  - Manages workspaces and sessions
  - Integrates with OpenCode Agent Client Protocol
  - Independent from sheet-services
6. **Apps Script** (`sheet-formulas`)
  - Runs within Google Sheets environment
  - Makes HTTP calls to `sheet-apis`
  - Uses `effect-platform-apps-script` for HTTP client

## Key Technologies

- **Effect.ts** (v3.19.8): Primary framework for type-safe, composable code
- **Rocicorp Zero**: Real-time sync protocol for database
- **TanStack Start**: Full-stack React framework with SSR
- **Drizzle ORM**: Type-safe SQL-like ORM for PostgreSQL
- **BetterAuth**: Authentication framework with Discord OAuth
- **dfx**: Discord Effect library for bot development
- **Nx**: Monorepo task runner and build system

## Development

### Prerequisites

- Node.js (LTS)
- pnpm
- PostgreSQL (for sheet services)
- Google Cloud project (for Sheets API)

### Setup

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm -w build

# Run checks (lint, format, typecheck, test)
pnpm -w checks

# Apply formatting
pnpm -w format:apply
```

### Package Scripts

Each package supports standard scripts:

```bash
# Build
pnpm -w build

# Run all checks
pnpm -w checks

# Apply formatting
pnpm -w format:apply

# Package-specific scripts (run from package directory)
pnpm db:generate    # Generate Drizzle migrations
pnpm db:migrate     # Run migrations
pnpm db:push        # Push schema changes
pnpm db:studio      # Open Drizzle Studio (vibecord only)
```

## Project Structure

```
.
├── packages/
│   ├── typhoon-core/              # Shared utilities, Zero integration, schema helpers
│   │   ├── src/schema/            # Schema utilities
│   │   ├── src/utils/             # Utility functions
│   │   ├── src/error/             # Error handling
│   │   └── src/services/          # Core services
│   ├── bob/                       # Config builder utility
│   ├── dfx-discord-utils/         # Discord utilities
│   │   ├── src/discord/           # Discord-specific utils
│   │   ├── src/cache/             # Caching utilities
│   │   └── src/utils/             # Command builders & helpers
│   ├── effect-platform-apps-script/  # GAS HTTP client
│   ├── start-atom/                # TanStack Start + Effect Atom
│   ├── sheet-apis/                # HTTP API server
│   │   ├── src/handlers/          # API handlers
│   │   ├── src/services/          # Business logic
│   │   ├── src/middlewares/       # Auth middleware
│   │   └── src/schemas/           # Protocol schemas
│   ├── sheet-db-server/           # Zero sync server
│   │   ├── src/handlers/zero/     # Zero handlers
│   │   ├── src/services/          # DB service
│   │   └── src/config/            # Configuration
│   ├── sheet-db-schema/           # Database schemas
│   │   ├── src/schema.ts          # Drizzle tables
│   │   └── src/zero/              # Zero schema & mutators
│   │       ├── mutators/          # Zero mutations
│   │       └── queries/           # Zero queries
│   ├── sheet-auth/                # Authentication service
│   │   ├── src/plugins/           # Auth plugins
│   │   ├── src/auth-config.ts     # BetterAuth config
│   │   └── src/schema.ts          # Auth tables
│   ├── sheet-web/                 # Web dashboard
│   │   ├── src/routes/            # TanStack routes
│   │   ├── src/components/        # React components
│   │   ├── src/lib/               # Utilities & state
│   │   └── src/hooks/             # Custom hooks
│   ├── sheet-bot/                 # Discord bot
│   │   ├── src/bot/               # Bot implementation
│   │   ├── src/commands/          # Slash commands
│   │   ├── src/services/          # Business logic
│   │   ├── src/messageComponents/ # Message components
│   │   └── src/tasks/             # Background tasks
│   ├── sheet-formulas/            # Apps Script formulas
│   │   └── src/formulas.ts        # Formula implementations
│   └── vibecord/                  # VibeCord bot
│       ├── src/bot/               # Bot implementation
│       ├── src/commands/          # Slash commands
│       ├── src/services/          # Business logic
│       ├── src/db/                # SQLite schema
│       └── src/sdk/               # ACP integration
├── AGENTS.md                      # AI agent documentation
├── README.md                      # This file
└── package.json                   # Workspace root
```

## Dependencies Overview

### Direct Dependencies

```mermaid
graph TD
    Web[sheet-web] -->|uses| APIs[sheet-apis]
    Web -->|uses| Auth[sheet-auth]
    Web -->|uses| Atom[start-atom]
    Web -->|uses| Core[typhoon-core]

    Bot[sheet-bot] -->|uses| APIs
    Bot -->|uses| Auth
    Bot -->|uses| DFX[dfx-discord-utils]
    Bot -->|uses| Core
    Bot -->|uses| Schema[sheet-db-schema]

    APIs -->|uses| Schema
    APIs -->|uses| Auth
    APIs -->|uses| Core
    APIs -->|uses| DFX

    DB[sheet-db-server] -->|uses| Schema
    DB -->|uses| Core

    Formulas[sheet-formulas] -->|uses| APIs
    Formulas -->|uses| GAS[effect-platform-apps-script]
    Formulas -->|uses| Core

    Schema -->|uses| Core
```
