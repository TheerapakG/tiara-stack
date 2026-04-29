import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi";
import { Schema } from "effect";
import { ReadonlyJSONValue } from "../schema";

export class ZeroHttpApi extends HttpApiGroup.make("zero")
  .add(
    HttpApiEndpoint.post("query", "/zero/query", {
      success: ReadonlyJSONValue,
      payload: ReadonlyJSONValue,
    }),
  )
  .add(
    HttpApiEndpoint.post("mutate", "/zero/mutate", {
      success: ReadonlyJSONValue,
      query: Schema.Record(Schema.String, Schema.String),
      payload: ReadonlyJSONValue,
    }),
  )
  .annotate(OpenApi.Title, "Zero")
  .annotate(OpenApi.Description, "Zero endpoints") {}
