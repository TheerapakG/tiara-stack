import { Schema } from "effect";

export const config = {
  discordClientId: Schema.Config("DISCORD_CLIENT_ID", Schema.String),
  discordClientSecret: Schema.Config("DISCORD_CLIENT_SECRET", Schema.Redacted(Schema.String)),
  redisUrl: Schema.Config("REDIS_URL", Schema.String),
  kubernetesAudience: Schema.Config("KUBERNETES_AUDIENCE", Schema.String),
  kubernetesApiServerUrl: Schema.Config("KUBERNETES_API_SERVER_URL", Schema.String),
};
