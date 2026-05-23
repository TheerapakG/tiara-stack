import type { ErroredQuery, RunOptions } from "@rocicorp/zero";
import { describe, expect, it } from "@effect/vitest";
import { Cause, Effect, Exit } from "effect";
import * as ZeroClient from "./zeroClient";

const makeClient = (zero: unknown) => ZeroClient.ZeroClient<any, any, any>().make(zero as never);

describe("ZeroClient", () => {
  it.effect(
    "resolves unknown query data from the materialized snapshot",
    Effect.fnUntraced(function* () {
      let destroyed = false;
      const zero = {
        materialize: (_query: unknown, options: { ttl?: RunOptions["ttl"] }) => {
          expect(options).toEqual({ ttl: "1m" });
          return {
            data: [{ id: "item-1" }],
            addListener: () => {
              throw new Error("should not listen for unknown query results");
            },
            destroy: () => {
              destroyed = true;
            },
            updateTTL: () => undefined,
          };
        },
        run: () => Promise.reject(new Error("should not call zero.run")),
        mutate: () => {
          throw new Error("should not call zero.mutate");
        },
      };
      const client = yield* makeClient(zero);

      const result = yield* client.run({} as never, { type: "unknown", ttl: "1m" });

      expect(result).toEqual([{ id: "item-1" }]);
      expect(destroyed).toBe(true);
    }),
  );

  it.effect(
    "treats missing run options as an unknown materialized snapshot",
    Effect.fnUntraced(function* () {
      let destroyed = false;
      const zero = {
        materialize: (_query: unknown, options: { ttl?: RunOptions["ttl"] }) => {
          expect(options).toEqual({ ttl: undefined });
          return {
            data: [{ id: "item-2" }],
            addListener: () => {
              throw new Error("should not listen without complete run options");
            },
            destroy: () => {
              destroyed = true;
            },
            updateTTL: () => undefined,
          };
        },
        run: () => Promise.reject(new Error("should not call zero.run")),
        mutate: () => {
          throw new Error("should not call zero.mutate");
        },
      };
      const client = yield* makeClient(zero);

      const result = yield* client.run({} as never);

      expect(result).toEqual([{ id: "item-2" }]);
      expect(destroyed).toBe(true);
    }),
  );

  it.effect(
    "preserves Zero error details for complete query failures",
    Effect.fnUntraced(function* () {
      let destroyed = false;
      let removed = false;
      const error: ErroredQuery = {
        error: "app",
        id: "getGuildConfigByGuildId",
        name: "guildConfig.getGuildConfigByGuildId",
        message: "boom",
      };
      const zero = {
        materialize: (_query: unknown, options: { ttl?: RunOptions["ttl"] }) => {
          expect(options).toEqual({ ttl: "forever" });
          return {
            data: undefined,
            addListener: (
              listener: (data: unknown, result: "error", error: ErroredQuery) => void,
            ) => {
              listener(undefined, "error", error);
              return () => {
                removed = true;
              };
            },
            destroy: () => {
              destroyed = true;
            },
            updateTTL: () => undefined,
          };
        },
        run: () => Promise.reject(new Error("should not call zero.run")),
        mutate: () => {
          throw new Error("should not call zero.mutate");
        },
      };
      const client = yield* makeClient(zero);

      const exit = yield* Effect.exit(
        client.run({} as never, { type: "complete", ttl: "forever" }),
      );

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const prettyCause = Cause.pretty(exit.cause);
        expect(prettyCause).toContain("getGuildConfigByGuildId");
        expect(prettyCause).toContain("guildConfig.getGuildConfigByGuildId");
        expect(prettyCause).toContain("boom");
        expect(prettyCause).not.toContain("got undefined");
      }
      expect(destroyed).toBe(true);
      expect(removed).toBe(true);
    }),
  );

  it.effect(
    "resolves complete query data from a materialized complete result",
    Effect.fnUntraced(function* () {
      let destroyed = false;
      let removed = false;
      const zero = {
        materialize: () => ({
          data: undefined,
          addListener: (listener: (data: unknown, result: "complete") => void) => {
            listener([{ id: "item-1" }], "complete");
            return () => {
              removed = true;
            };
          },
          destroy: () => {
            destroyed = true;
          },
          updateTTL: () => undefined,
        }),
        run: () => Promise.reject(new Error("should not call zero.run")),
        mutate: () => {
          throw new Error("should not call zero.mutate");
        },
      };
      const client = yield* makeClient(zero);

      const result = yield* client.run({} as never, { type: "complete" });

      expect(result).toEqual([{ id: "item-1" }]);
      expect(destroyed).toBe(true);
      expect(removed).toBe(true);
    }),
  );
});
