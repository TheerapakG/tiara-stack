import { HttpApiBuilder } from "@effect/platform";
import { handleMutateRequest, handleQueryRequest } from "@rocicorp/zero/server";
import { mustGetMutator, mustGetQuery } from "@rocicorp/zero";
import { Effect, Layer, pipe } from "effect";
import { Api } from "@/api";
import { queries, mutators, schema } from "sheet-db-schema/zero";
import { DBService } from "@/services/db";

export const ZeroHttpLive = HttpApiBuilder.group(Api, "zero", (handlers) =>
  pipe(
    DBService,
    Effect.andThen((dbService) =>
      handlers
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
        .handle("mutate", ({ urlParams, payload }) =>
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
              urlParams,
              payload,
            ),
          ),
        ),
    ),
  ),
).pipe(Layer.provide(DBService.Default));
