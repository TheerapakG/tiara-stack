import { pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";

export const getScreenshotHandlerConfig = pipe(
  Handler.Config.empty(),
  Handler.Config.Builder.type("subscription"),
  Handler.Config.Builder.name("screenshot.getScreenshot"),
  Handler.Config.Builder.requestParams({
    validator: pipe(
      Schema.Struct({
        guildId: Schema.String,
        channel: Schema.String,
        day: Schema.Number,
      }),
      Schema.standardSchemaV1,
    ),
  }),
  Handler.Config.Builder.response({
    validator: pipe(Schema.Uint8Array, Schema.standardSchemaV1),
  }),
);
