import { Effect, Schema } from "effect";
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const env = Effect.runSync(
  Schema.decodeUnknown(
    Schema.Struct({
      POSTGRES_URL: Schema.optionalWith(Schema.String, { default: () => "" }),
    }),
  )(process.env),
);

export default defineConfig({
  schema: "./src/schema.ts",
  dialect: "postgresql",
  extensionsFilters: ["postgis"],
  dbCredentials: {
    url: env.POSTGRES_URL,
  },
});
