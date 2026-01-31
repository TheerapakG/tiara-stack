import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "@effect/platform";
import { Schema } from "effect";
import { ReadonlyJSONValue } from "typhoon-core/schema";

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
