import { Effect, Layer, pipe } from "effect";
import { MembersApiCacheView } from "dfx-discord-utils/discord";
import { type SheetAuthClient as SheetAuthClientValue } from "sheet-auth/client";
import { GuildConfigService } from "../../services/guildConfig";
import { SheetAuthClient } from "../../services/sheetAuthClient";
import { makeSheetAuthTokenAuthorization } from "./shared";
import { SheetAuthTokenAuthorization } from "./tag";

export const SheetAuthTokenAuthorizationLiveLayer = Layer.effect(
  SheetAuthTokenAuthorization,
  pipe(
    Effect.all({
      authClient: SheetAuthClient,
      guildConfigService: GuildConfigService,
      membersCache: MembersApiCacheView,
    }),
    Effect.flatMap(({ authClient, guildConfigService, membersCache }) =>
      makeSheetAuthTokenAuthorization(
        authClient as SheetAuthClientValue,
        guildConfigService,
        membersCache,
      ),
    ),
  ),
);

export const SheetAuthTokenAuthorizationLive = SheetAuthTokenAuthorizationLiveLayer.pipe(
  Layer.provide(Layer.mergeAll(SheetAuthClient.Default, GuildConfigService.Default)),
);
