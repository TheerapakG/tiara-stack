import { Config, Schema } from "effect";

export const config = {
  discordToken: Config.schema(Schema.Redacted(Schema.String), "DISCORD_TOKEN"),
  podNamespace: Config.string("POD_NAMESPACE"),
  redisUrl: Config.schema(Schema.Redacted(Schema.String), "REDIS_URL"),
  sheetIngressNamespace: Config.option(Config.string("SHEET_INGRESS_NAMESPACE")),
  sheetIngressKubernetesAudience: Config.string("SHEET_INGRESS_KUBERNETES_AUDIENCE").pipe(
    Config.withDefault("sheet-bot"),
  ),
  sheetIngressBaseUrl: Config.schema(Schema.String, "SHEET_INGRESS_BASE_URL"),
  sheetAuthIssuer: Config.schema(Schema.String, "SHEET_AUTH_ISSUER"),
};
