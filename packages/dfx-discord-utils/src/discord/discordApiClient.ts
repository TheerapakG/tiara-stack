import { HttpApiClient } from "effect/unstable/httpapi";
import { Layer, Context } from "effect";
import { DiscordApi } from "./api";
import { HttpClient } from "effect/unstable/http";

type DiscordApiClientRoutes = HttpApiClient.ForApi<typeof DiscordApi>;

type DiscordApiClientService = {
  readonly application: Pick<DiscordApiClientRoutes["application"], "getApplication">;
  readonly bot: Pick<DiscordApiClientRoutes["bot"], "createInteractionResponse" | "sendMessage">;
  readonly cache: Pick<
    DiscordApiClientRoutes["cache"],
    | "getGuild"
    | "getChannel"
    | "getRole"
    | "getMember"
    | "getChannelsForParent"
    | "getRolesForParent"
    | "getMembersForParent"
    | "getChannelsForResource"
    | "getRolesForResource"
    | "getMembersForResource"
  >;
};

// Tag for dependency injection
export class DiscordApiClient extends Context.Service<DiscordApiClient, DiscordApiClientService>()(
  "DiscordApiClient",
) {
  // Live layer - requires explicit base URL configuration
  static layer = (baseUrl: string): Layer.Layer<DiscordApiClient, never, HttpClient.HttpClient> =>
    Layer.effect(
      DiscordApiClient,
      HttpApiClient.make(DiscordApi, {
        baseUrl,
      }),
    );
}
