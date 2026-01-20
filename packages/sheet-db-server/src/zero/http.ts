import { HttpApiBuilder } from "@effect/platform";
import { handleQueryRequest } from "@rocicorp/zero/server";
import { mustGetQuery } from "@rocicorp/zero";
import { Effect } from "effect";
import { Api } from "../api";
import { queries, schema } from "sheet-db-schema/zero";

export const ZeroHttpLive = HttpApiBuilder.group(Api, "zero", (handlers) =>
  handlers.handle("query", ({ payload }) =>
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
  ),
);
