import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "@effect/platform";
import { Schema } from "effect";
import type { ReadonlyJSONValue, ReadonlyJSONObject } from "@rocicorp/zero";

const ReadonlyJSONValue = Schema.Union(
  Schema.Null,
  Schema.String,
  Schema.Boolean,
  Schema.Number,
  Schema.Array(
    Schema.suspend((): Schema.Schema<ReadonlyJSONValue> => ReadonlyJSONValue).annotations({
      identifier: "ReadonlyJSONValue",
    }),
  ),
  Schema.suspend((): Schema.Schema<ReadonlyJSONObject> => ReadonlyJSONObject).annotations({
    identifier: "ReadonlyJSONObject",
  }),
);

const ReadonlyJSONObject = Schema.Record({
  key: Schema.String,
  value: Schema.Union(
    Schema.suspend((): Schema.Schema<ReadonlyJSONValue> => ReadonlyJSONValue).annotations({
      identifier: "ReadonlyJSONValue",
    }),
    Schema.Undefined,
  ),
});

export class ZeroApi extends HttpApiGroup.make("zero")
  .add(
    HttpApiEndpoint.post("query", "/zero/query")
      .addSuccess(Schema.Unknown)
      .setPayload(ReadonlyJSONValue),
  )
  .add(
    HttpApiEndpoint.post("mutate", "/zero/mutate")
      .addSuccess(Schema.Unknown)
      .setUrlParams(Schema.Record({ key: Schema.String, value: Schema.String }))
      .setPayload(ReadonlyJSONValue),
  )
  .annotate(OpenApi.Title, "Zero")
  .annotate(OpenApi.Description, "Zero endpoints") {}
