import { Config, Schema } from "effect";

export const config = {
  postgresUrl: Config.schema(Schema.String, "POSTGRES_URL"),
};
