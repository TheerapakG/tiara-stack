import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi";
import { Schema } from "effect";
import { ReadonlyJSONValue } from "typhoon-core/schema";

export class ZeroApi extends HttpApiGroup.make("zero")
  .add(
    HttpApiEndpoint.post("query", "/zero/query", {
      success: Schema.Unknown,
      payload: ReadonlyJSONValue,
    }),
  )
  .add(
    HttpApiEndpoint.post("mutate", "/zero/mutate", {
      success: Schema.Unknown,
      query: Schema.Record(Schema.String, Schema.String),
      payload: ReadonlyJSONValue,
    }),
  )
  .annotate(OpenApi.Title, "Zero")
  .annotate(OpenApi.Description, "Zero endpoints") {}
