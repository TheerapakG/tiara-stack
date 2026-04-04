import { HttpApiBuilder } from "effect/unstable/httpapi";
import { handleMutateRequest, handleQueryRequest } from "@rocicorp/zero/server";
import { mustGetMutator, mustGetQuery, type ReadonlyJSONValue } from "@rocicorp/zero";
import { Effect, Layer } from "effect";
import { Api } from "@/api";
import { queries, mutators, schema } from "sheet-db-schema/zero";
import { DBService } from "@/services/db";

const removeUndefinedFields = (obj: ReadonlyJSONValue | undefined): ReadonlyJSONValue => {
  if (Array.isArray(obj)) {
    return obj.map(removeUndefinedFields);
  }
  if (typeof obj === "object" && obj !== null) {
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([_, value]) => value !== undefined)
        .map(([key, value]) => [key, removeUndefinedFields(value)]),
    );
  }
  return obj !== undefined ? obj : null;
};

export const ZeroHttpLive = HttpApiBuilder.group(
  Api,
  "zero",
  Effect.fnUntraced(function* (handlers) {
    const dbService = yield* DBService;

    return handlers
      .handle("query", ({ payload }) =>
        Effect.promise(() =>
          handleQueryRequest(
            (name, args) => {
              const query = mustGetQuery(queries, name);
              return query.fn({ args, ctx: {} });
            },
            schema,
            payload,
          ),
        ).pipe(Effect.map(removeUndefinedFields)),
      )
      .handle("mutate", ({ query, payload }) =>
        Effect.promise(() =>
          handleMutateRequest(
            dbService.zql,
            (transact) =>
              transact((tx, name, args) => {
                const mutator = mustGetMutator(mutators, name);
                return mutator.fn({
                  args,
                  tx,
                  ctx: {},
                });
              }),
            query,
            payload,
          ),
        ).pipe(Effect.map(removeUndefinedFields)),
      );
  }),
).pipe(Layer.provide(DBService.layer));
