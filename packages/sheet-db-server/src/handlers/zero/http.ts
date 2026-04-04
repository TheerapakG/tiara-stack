import { HttpApiBuilder } from "effect/unstable/httpapi";
import { handleMutateRequest, handleQueryRequest } from "@rocicorp/zero/server";
import { mustGetMutator, mustGetQuery } from "@rocicorp/zero";
import { Effect, Layer } from "effect";
import { Api } from "@/api";
import { queries, mutators, schema } from "sheet-db-schema/zero";
import { DBService } from "@/services/db";

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
        ),
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
        ),
      );
  }),
).pipe(Layer.provide(DBService.layer));
