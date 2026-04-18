# TiaraStack Monorepo Package Overview

This monorepo contains the following packages:

> **Note:** For the complete project structure and architecture diagrams, see the [README.md](./README.md).

## Core Infrastructure Packages

### `typhoon-core` (packages/typhoon-core)

Shared utilities library providing Effect.js integration for Rocicorp Zero, schema transformation helpers, standardized error types, and common utilities used across the monorepo.

**Dependencies**: `@rocicorp/zero`, `@standard-schema/spec` (peer: `effect`)

## Application Packages

### `sheet-apis` (packages/sheet-apis)

Backend API server for Google Sheets integration using Effect's HttpApiBuilder, providing HTTP API handlers for sheet operations, calculations, guild configuration, and message management.

**Dependencies**: Effect ecosystem, `@googleapis/sheets`, `@rocicorp/zero`, Playwright, `sheet-db-schema`, `sheet-auth`, `typhoon-core`, `dfx`, `dfx-discord-utils`

### `sheet-db-server` (packages/sheet-db-server)

Database server providing Zero (real-time sync) HTTP API for the sheet database schema using Rocicorp Zero.

**Dependencies**: Effect ecosystem, `@rocicorp/zero`, `drizzle-orm`, `postgres`, `sheet-db-schema`, `typhoon-core`

### `sheet-db-schema` (packages/sheet-db-schema)

Database schema definitions using Drizzle ORM for PostgreSQL with Zero integration.

**Dependencies**: `@rocicorp/zero`, `drizzle-orm`, `drizzle-zero`, `postgres`, `typhoon-core`, `effect`

### `sheet-auth` (packages/sheet-auth)

Authentication service using BetterAuth for Discord OAuth, JWT tokens, and Kubernetes OAuth integration.

**Dependencies**: Effect ecosystem, `better-auth`, `@better-auth/oauth-provider`, `hono`, `@hono/node-server`, `drizzle-orm`, `postgres`, `ioredis`, `unstorage`, `jose`

**Peer Dependencies**: `@better-fetch/fetch`, `@standard-schema/spec`, `nanostores`

**Exports**: `.`, `./client`, `./schema`, `./server`, `./plugins/kubernetes-oauth`, `./plugins/kubernetes-oauth/client`

### `sheet-web` (packages/sheet-web)

Web application for the sheet system built with TanStack Start, providing a dashboard for guild management, scheduling, and calendar views.

**Dependencies**: TanStack Start/React ecosystem, Effect, `better-auth`, `sheet-apis`, `sheet-auth`, `start-atom`, `typhoon-core`, shadcn/ui components, Recharts

### `sheet-bot` (packages/sheet-bot)

Discord bot application that integrates with sheet-apis to provide Discord commands and interactions.

**Dependencies**: Effect ecosystem, `dfx`, `dfx-discord-utils`, `discord-api-types`, `@discordjs/builders`, `ts-mixer`, `handlebars`, `sheet-apis`, `sheet-auth`, `sheet-db-schema`, `typhoon-core`

### `sheet-formulas` (packages/sheet-formulas)

Google Apps Script formulas library for performing calculations and operations on Google Sheets. Deployed as a Google Apps Script project.

**Dependencies**: Effect, `@effect/platform`, `effect-platform-apps-script`, `sheet-apis`, `typhoon-core`

### `vibecord` (packages/vibecord)

Discord bot application for VibeCord, providing workspace and session management with ACP (Agent Client Protocol) integration.

**Dependencies**: `discord.js`, `drizzle-orm`, `@effect/sql-drizzle`, `better-sqlite3`, `@opencode-ai/sdk`, `simple-git`, `diff`, `c12`, `effect`

**Database Scripts**: `db:generate`, `db:migrate`, `db:push`, `db:studio`

## Utility Packages

### `bob` (packages/bob)

Configuration builder utility library for building type-safe configuration objects with validation using Standard Schema.

**Dependencies**: `@standard-schema/spec`

**Dev Dependencies**: `arktype` (for testing)

### `dfx-discord-utils` (packages/dfx-discord-utils)

Discord utilities library extending dfx (Discord Effect) with caching, command builders, and interaction helpers.

**Dependencies**: `@discordjs/builders`, `discord-api-types`, `ts-mixer`, `unstorage`

**Peer Dependencies**: `effect`, `@effect/platform`, `@effect/platform-node`, `dfx`

### `effect-platform-apps-script` (packages/effect-platform-apps-script)

Effect Platform HTTP client implementation for Google Apps Script environment.

**Peer Dependencies**: `effect`, `@effect/platform`

**Dev Dependencies**: `@types/google-apps-script`

### `start-atom` (packages/start-atom)

Integration library connecting TanStack Start with Effect Atom for server-side rendering (SSR) compatible state management.

**Dependencies**: `@effect-atom/atom-react`, `@tanstack/router-core`

**Peer Dependencies**: `effect`, `react`, `@tanstack/react-router`, `@tanstack/react-start`, `@tanstack/router-core`

## Workspace Scripts

The following workspace-level scripts are defined in `package.json`:

- **`format`**: `vp run -r format` - Runs format checks across packages that define a format script
- **`lint`**: `vp run -r lint` - Runs lint plus type-aware TypeScript checks across packages that define a lint script
- **`test`**: `vp run -r test` - Runs tests across packages that define a test script
- **`build`**: `vp run -r build` - Builds all packages
- **`checks`**: `pnpm format && pnpm lint && pnpm test` - Runs format checks, lint/type checks, and tests across packages that define those scripts
- **`format:apply`**: `vp run -r format:apply` - Applies formatting across all packages that define a format script

Run these scripts from the repo root using `pnpm <script>`.

Run `pnpm format:apply` every time after you finish proposing a change to correctly format all the code.

## Package Scripts

Packages with source code generally have the following standard scripts:

- **`build`**: Compiles TypeScript and creates distribution bundles
- **`format`**: Checks formatting via `vp fmt --check`
- **`format:apply`**: Applies formatting via `vp fmt`
- **`lint`**: Runs linting via `vp lint src`; in this repo's Vite+ packages it also performs type-aware TypeScript checking because `lint.options.typeCheck` is enabled
- **`test`**: Runs tests via `vp test run` where applicable
- **`test:watch`**: Runs tests in watch mode via `vp test` where applicable

Database-related packages (`sheet-auth`, `vibecord`) have additional scripts:

- **`db:generate`**: Generates Drizzle migrations
- **`db:migrate`**: Runs Drizzle migrations
- **`db:push`**: Pushes schema changes to database
- **`db:studio`**: Opens Drizzle Studio (vibecord only)

## Guidelines on Graphite Commit Messages For This Project

We use Graphite for managing stacked pull requests. The following guidelines are to be followed for `gt create` and `gt modify` commands.

- For the first commit you are creating
  - If you are on a trunk branch (master) use `gt create` to create the commit on a new branch. **DO NOT commit directly to master**
  - Otherwise, ask the developer if they want to create the commits on a new branch (`gt create`) or add commits to the current branch (`gt modify -c`).
  - When working in a git worktree (vibecord session)
    - Check if the branch name follows `<username>/<branch-name>` format
    - If the branch name does NOT follow the format, rename it: `git branch -m <username>/<new-branch-name>`
    - Track with trunk: `gt track --parent master`
    - Use `gt modify -c` for all commits (do NOT use `gt create`)
- For the rest of the commits, use `gt modify -c`.
- When you create the commits on a new branch
  - If the developer mentions that the commits is related to a linear issue, look up the git branch name to use via the linear MCP server. If the linear MCP server does not exist, tell the developer and stop proceeding.
  - Otherwise, come up with a descriptive branch name with the user prepended before the slash e.g. `<username>/branch-name`. **ALWAYS use the actual username. DO NOT directly put `<username>` in the branch name**
  - **ALWAYS set the branch name. DO NOT leave the branch name blank.**
- Use conventional commit message. If the work is done inside a package, use the name of the package (or a shortened version if it is not ambiguous) of the changes as the scope of the commit. Optionally, you could also append the area where the work was done inside the package e.g. `feat(example-package/utils): implement new utility x`
- There is no need to list functions or symbols affected by the changes separately from the main commit message body.
- Use -m for new line in the commit message, and do not use \n anywhere.

  GOOD:
  - `gt create matthew/abc-123-linear-issue-branch-name -m "subject" -m "line1" -m "line2"  ...`
    This correctly sets the branch name (for a user named "matthew" against a linear issue abc-123) and supplies commit message in the correct format for a new branch.
  - `gt modify -c -m "subject" -m "line1" -m "line2"  ...`
    This correctly supplies commit message in the correct format for the current branch.

  BAD:
  - `gt create matthew/abc-123-linear-issue-branch-name -m "subject\nline1\nline2\n..."`
    This correctly sets the branch name (for a user named "matthew" against a linear issue abc-123) BUT supplies commit message in a bad format.
  - `gt create matthew/abc-123-linear-issue-branch-name -m "subject" -m "line1\nline2\n..."`
    This correctly sets the branch name (for a user named "matthew" against a linear issue abc-123) BUT supplies commit message in a bad format.
  - `gt create -m "subject" -m "line1" -m "line2"  ...`
    This supplies commit message in the correct format BUT forgot to set the branch name for a new branch.
  - `gt create <username>/abc-123-linear-issue-branch-name -m "subject" -m "line1" -m "line2"  ...`
    This supplies commit message in the correct format BUT wrongly set the branch name with a placeholder username.
  - `gt modify -c -m "subject\nline1\nline2\n..."`
    This supplies commit message in a bad format.
  - `gt modify -c -m "subject" -m "line1\nline2\n..."`
    This supplies commit message in a bad format.

## Guidelines on Library Usages

### Effect.ts

This project utilizes the Effect library for composability and type-safety. The version of the library being used is 3.19.8. Use Effect/Schema for runtime validation except existing code use other validation library, or otherwise stated.

### Arktype

This project utilizes the ArkType library for runtime type validation in some limited case. The version of the library being used is 2.1.19.

## Package Dependency Graph

```
sheet-web
  ├─ sheet-apis
  ├─ sheet-auth
  ├─ start-atom
  └─ typhoon-core

sheet-bot
  ├─ sheet-apis
  ├─ sheet-auth
  ├─ sheet-db-schema
  ├─ typhoon-core
  └─ dfx-discord-utils

sheet-apis
  ├─ sheet-db-schema
  ├─ sheet-auth
  ├─ typhoon-core
  └─ dfx-discord-utils

sheet-db-server
  ├─ sheet-db-schema
  └─ typhoon-core

sheet-formulas
  ├─ sheet-apis
  ├─ effect-platform-apps-script
  └─ typhoon-core

sheet-db-schema
  └─ typhoon-core

dfx-discord-utils
  (peer dependencies: effect, dfx)

start-atom
  (peer dependencies: effect, react, @tanstack/react-router)

effect-platform-apps-script
  (peer dependencies: effect, @effect/platform)

bob
  (no workspace dependencies)

typhoon-core
  (peer dependency: effect)

vibecord
  (standalone, no workspace dependencies)
```
