# TiaraStack Monorepo Package Overview

This monorepo contains the following packages:

## Core Infrastructure Packages

### `typhoon-core` (packages/typhoon-core)

Core framework for building RPC-like communication systems with WebSocket support.

- **Main export** (`packages/typhoon-core/src/index.ts`): Exports Handler, Observability, Protocol, Runtime, Schema, Server, Signal, Utils, Validator, Bundler, Error, Services modules
- **Sub-exports** (`packages/typhoon-core/src/*`): Each subdirectory can be imported as `typhoon-core/<module-name>`
- **Handler** (`packages/typhoon-core/src/handler`): Request/response handler context and types
- **Protocol** (`packages/typhoon-core/src/protocol`): Communication protocol definitions including Msgpack serialization
- **Runtime** (`packages/typhoon-core/src/runtime`): Runtime state management
- **Server** (`packages/typhoon-core/src/server`): Server-side handler data and utilities
- **Schema** (`packages/typhoon-core/src/schema`): Schema definitions for validation
- **Utils** (`packages/typhoon-core/src/utils`): Utility functions and data structures
- **Validator** (`packages/typhoon-core/src/validator`): Validation utilities
- **Signal** (`packages/typhoon-core/src/signal`): Signal/event handling
- **Observability** (`packages/typhoon-core/src/observability`): Observability and monitoring utilities
- **Bundler** (`packages/typhoon-core/src/bundler`): Code bundling utilities
- **Error** (`packages/typhoon-core/src/error`): Error handling utilities
- **Services** (`packages/typhoon-core/src/services`): Core service implementations

## Application Packages

### `sheet-apis` (packages/sheet-apis)

Backend API server for Google Sheets integration using Effect's HttpApiBuilder, providing HTTP API handlers for sheet operations, calculations, guild configuration, and message management.

- **Main entry** (`packages/sheet-apis/src/index.ts`): Server entry point that launches the HTTP API server
- **HTTP** (`packages/sheet-apis/src/http.ts`): HTTP server configuration with all handler groups
- **API** (`packages/sheet-apis/src/api.ts`): API definitions using HttpApiBuilder
- **Metrics** (`packages/sheet-apis/src/metrics.ts`): OpenTelemetry metrics configuration
- **Traces** (`packages/sheet-apis/src/traces.ts`): OpenTelemetry traces configuration
- **Handlers** (`packages/sheet-apis/src/handlers`): HTTP API handler implementations for:
  - Calc: Sheet calculation operations
  - GuildConfig: Discord guild configuration management
  - Health: Health check endpoint
  - MessageCheckin: Check-in message handling
  - MessageRoomOrder: Room ordering message handling
  - MessageSlot: Slot message handling
  - Monitor: Monitoring and observability
  - Player: Player data management
  - Schedule: Scheduling operations
  - Screenshot: Screenshot generation
  - Sheet: Google Sheets operations
- **Services** (`packages/sheet-apis/src/services`): Business logic services:
  - calc.ts: Calculation service
  - google/: Google Sheets API integration
  - guildConfig.ts: Guild configuration service
  - messageCheckin.ts: Check-in message service
  - messageRoomOrder.ts: Room order message service
  - messageSlot.ts: Slot message service
  - monitor.ts: Monitoring service
  - player.ts: Player data service
  - schedule.ts: Scheduling service
  - screenshot.ts: Screenshot service
  - sheet.ts: Google Sheets operations service
  - sheetConfig.ts: Sheet configuration service
  - zero.ts: Zero sync service
- **Schemas** (`packages/sheet-apis/src/schemas`): Protocol buffer schema definitions
- **Config** (`packages/sheet-apis/src/config.ts`): Configuration management

### `sheet-db-server` (packages/sheet-db-server)

Database server providing Zero (real-time sync) HTTP API for the sheet database schema using Rocicorp Zero.

- **Main entry** (`packages/sheet-db-server/src/index.ts`): Server entry point that launches the HTTP API server
- **HTTP** (`packages/sheet-db-server/src/http.ts`): HTTP server configuration with Zero handler group
- **API** (`packages/sheet-db-server/src/api.ts`): API definitions using HttpApiBuilder
- **Metrics** (`packages/sheet-db-server/src/metrics.ts`): OpenTelemetry metrics configuration
- **Traces** (`packages/sheet-db-server/src/traces.ts`): OpenTelemetry traces configuration
- **Handlers** (`packages/sheet-db-server/src/handlers`): HTTP API handler implementations for:
  - Zero: Real-time sync handlers for query and mutate requests using Rocicorp Zero
- **Services** (`packages/sheet-db-server/src/services`): Database service layer

### `sheet-bot` (packages/sheet-bot)

Discord bot application that integrates with sheet-apis to provide Discord commands and interactions.

- **Main export** (`packages/sheet-bot/src/index.ts`): Bot entry point that initializes Discord bot with commands and handlers
- **register** (`packages/sheet-bot/src/register.ts`): Discord command registration script
- **Bot** (`packages/sheet-bot/src/bot`): Discord bot implementation
- **Commands** (`packages/sheet-bot/src/commands`): Discord slash command handlers
- **Services** (`packages/sheet-bot/src/services`): Business logic services for guild, member, collection, message, channel, and interaction management
- **MessageComponents** (`packages/sheet-bot/src/messageComponents`): Discord message component handlers (buttons, etc.)
- **Types** (`packages/sheet-bot/src/types`): Type definitions for handlers and errors
- **Config** (`packages/sheet-bot/src/config`): Configuration management
- **Utils** (`packages/sheet-bot/src/utils`): Utility functions
- **Tasks** (`packages/sheet-bot/src/tasks`): Background task implementations including auto-checkin

### `sheet-formulas` (packages/sheet-formulas)

Google Apps Script formulas library for performing calculations and operations on Google Sheets.

- **Main export** (`packages/sheet-formulas/src/index.ts`): Exports formula functions
- **Formulas** (`packages/sheet-formulas/src/formulas.ts`): Formula implementations for parsing players, calculating stats, and performing sheet operations

### `sheet-db-schema` (packages/sheet-db-schema)

Database schema definitions using Drizzle ORM for PostgreSQL.

- **Main export** (`packages/sheet-db-schema/src/schema.ts`): Exports Drizzle table definitions:
  - configGuild: Guild configuration table
  - configGuildManagerRole: Guild manager role configuration
  - configGuildChannel: Guild channel configuration
  - messageSlot: Message slot tracking
  - messageCheckin: Check-in message tracking
  - messageCheckinMember: Member check-in records
  - messageRoomOrder: Room order message tracking
  - messageRoomOrderEntry: Room order entry records
- **Zero** (`packages/sheet-db-schema/src/zero`): Rocicorp Zero schema definitions:
  - queries: Zero query definitions
  - mutators: Zero mutator definitions

### `vibecord` (packages/vibecord)

Discord bot application for VibeCord, providing workspace and session management with ACP (Agent Client Protocol) integration.

- **Main export** (`packages/vibecord/src/index.ts`): Exports package name and version
- **register** (`packages/vibecord/src/register.ts`): Discord command registration script
- **Bot** (`packages/vibecord/src/bot`): Discord bot implementation with Gateway event handling
- **Commands** (`packages/vibecord/src/commands`): Discord slash command handlers including workspace and session management
- **ACP** (`packages/vibecord/src/acp`): OpenCode Agent Client Protocol integration
- **DB** (`packages/vibecord/src/db`): Database service layer using Drizzle ORM with SQLite
- **Config** (`packages/vibecord/src/config`): Configuration management
- **Utils** (`packages/vibecord/src/utils`): Utility functions

## Utility Packages

### `bob` (packages/bob)

Configuration builder utility library for building type-safe configuration objects with validation.

- **Main export** (`packages/bob/src/builder/index.ts`): Exports configBuilderBuilder function and ConfigBuilder/ConfigBuilderBuilder classes for creating type-safe configuration builders with Standard Schema validation

## Scripts

There are two workspace-level scripts defined in package.json.
The "build" script invokes nx to build all the packages.
The "format:apply" script invokes nx to apply the prettier formatter across all the packages.
The "checks" script invokes nx to run linter, formatter, and type checkers in all the packages.
Run these scripts using `pnpm -w <script>`, replacing `<script>` with the script you want to run.
Run `pnpm -w format:apply` every time after you finished proposing a change to correctly format all the code.

# Guidelines on Graphite Commit Messages For This Project

We use Graphite for managing stacked pull requests. The following guidelines are to be followed for `gt create` and `gt modify` commands.

- For the first commit you are creating
  - If you are on a trunk branch (master) use `gt create` to create the commit on a new branch. **DO NOT commit directly to master**
  - Otherwise, ask the developer if they want to create the commits on a new branch (`gt create`) or add commits to the current branch (`gt modify -c`).
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

# Guidelines on Library Usages

## Effect.ts

This project utilizes the Effect library for composability and type-safety. The version of the library being used is 3.19.8. The project prefers using the "pipe" syntax (with "do simulation" to combat excessive nesting) over the "generator" syntax. Use Effect/Schema for runtime validation except existing code use other validation library, or otherwise stated.

## Arktype

This project utilizes the ArkType library for runtime type validation in some limited case. The version of the library being used is 2.1.19.
