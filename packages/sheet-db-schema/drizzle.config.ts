import { Effect, Schema } from "effect";
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const env = Schema.decodeUnknownSync(
  Schema.Struct({
    POSTGRES_URL: Schema.optional(Schema.String).pipe(
      Schema.withDecodingDefault(Effect.succeed("")),
    ),
  }),
)(process.env);

export default defineConfig({
  schema: "./src/schema.ts",
  dialect: "postgresql",
  extensionsFilters: ["postgis"],
  dbCredentials: {
    url: env.POSTGRES_URL ?? "",
  },
});
