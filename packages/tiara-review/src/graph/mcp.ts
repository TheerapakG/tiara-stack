import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import process from "node:process";
import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { z } from "zod";
import { migrate, sqliteLayer } from "../db/client";
import {
  getSymbolDependenciesEffect,
  getSymbolDependentsEffect,
  lookupDependencyGraphSymbolEffect,
} from "./store";
import { dependencyEdgeKinds } from "./types";

const jsonText = (value: unknown) => ({
  content: [
    {
      type: "text" as const,
      text: JSON.stringify(value, null, 2),
    },
  ],
});

const errorMessage = (cause: unknown) => {
  if (cause instanceof Error) {
    return cause.message;
  }
  if (typeof cause === "object" && cause !== null) {
    try {
      return JSON.stringify(cause);
    } catch {
      return "Unserializable error object";
    }
  }
  if (typeof cause === "string") {
    return cause;
  }
  if (
    typeof cause === "number" ||
    typeof cause === "boolean" ||
    typeof cause === "bigint" ||
    typeof cause === "symbol"
  ) {
    return cause.toString();
  }
  return "Unknown error";
};

const runToolEffect = <A>(effect: Effect.Effect<A, unknown>) =>
  Effect.runPromise(effect)
    .then(jsonText)
    .catch((cause: unknown) => ({
      ...jsonText({ error: errorMessage(cause) }),
      isError: true,
    }));

const edgeKindSchema = z.enum(dependencyEdgeKinds);

export const runDependencyGraphMcpServer = (input: {
  readonly dbPath: string;
  readonly versionId: string;
}) =>
  Effect.scoped(
    Effect.gen(function* () {
      yield* migrate(input.dbPath);
      const sql = yield* SqlClient.SqlClient;
      const runGraphToolEffect = <A>(effect: Effect.Effect<A, unknown, SqlClient.SqlClient>) =>
        runToolEffect(effect.pipe(Effect.provideService(SqlClient.SqlClient, sql)));

      yield* Effect.tryPromise({
        try: async () => {
          const server = new McpServer({
            name: "tiara-review-graph",
            version: "0.0.0",
          });

          server.registerTool(
            "resolve_symbol",
            {
              title: "Resolve TypeScript Symbol",
              description:
                "Resolve a TypeScript symbol by name or source location in the current review graph version.",
              inputSchema: {
                name: z.string().optional(),
                file: z.string().optional(),
                line: z.number().int().positive().optional(),
                column: z.number().int().positive().optional(),
                limit: z.number().int().positive().max(100).optional(),
              },
            },
            async (args) =>
              runGraphToolEffect(
                lookupDependencyGraphSymbolEffect({
                  versionId: input.versionId,
                  name: args.name,
                  file: args.file,
                  line: args.line,
                  column: args.column,
                  limit: args.limit,
                }),
              ),
          );

          server.registerTool(
            "symbol_dependencies",
            {
              title: "Get TypeScript Symbol Dependencies",
              description:
                "Return outgoing dependency edges for a TypeScript symbol in the current review graph version.",
              inputSchema: {
                symbolKey: z.string(),
                edgeKinds: z.array(edgeKindSchema).optional(),
                limit: z.number().int().positive().max(500).optional(),
              },
            },
            async (args) =>
              runGraphToolEffect(
                getSymbolDependenciesEffect({
                  versionId: input.versionId,
                  symbolKey: args.symbolKey,
                  edgeKinds: args.edgeKinds,
                  limit: args.limit,
                }),
              ),
          );

          server.registerTool(
            "symbol_dependents",
            {
              title: "Get TypeScript Symbol Dependents",
              description:
                "Return incoming dependency edges for a TypeScript symbol in the current review graph version.",
              inputSchema: {
                symbolKey: z.string(),
                edgeKinds: z.array(edgeKindSchema).optional(),
                limit: z.number().int().positive().max(500).optional(),
              },
            },
            async (args) =>
              runGraphToolEffect(
                getSymbolDependentsEffect({
                  versionId: input.versionId,
                  symbolKey: args.symbolKey,
                  edgeKinds: args.edgeKinds,
                  limit: args.limit,
                }),
              ),
          );

          const transport = new StdioServerTransport();
          const closed = new Promise<void>((resolve, reject) => {
            transport.onclose = () => resolve();
            transport.onerror = (error) => reject(error);
            let closeScheduled = false;
            const closeTransport = () => {
              if (closeScheduled) {
                return;
              }
              closeScheduled = true;
              void transport.close().catch(reject);
            };
            process.stdin.once("end", closeTransport);
            process.stdin.once("close", closeTransport);
          });
          await server.connect(transport);
          await closed;
        },
        catch: (cause) => cause,
      });
    }).pipe(Effect.provide(sqliteLayer(input.dbPath))),
  );
