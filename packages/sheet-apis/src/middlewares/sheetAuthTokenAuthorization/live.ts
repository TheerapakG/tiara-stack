import { Effect, Layer, pipe } from "effect";
import { MembersApiCacheView, RolesApiCacheView } from "dfx-discord-utils/discord";
import { type SheetAuthClient as SheetAuthClientValue } from "sheet-auth/client";
import { GuildConfigService } from "../../services/guildConfig";
import { ApplicationOwnerResolver } from "../../services/applicationOwner";
import { SheetAuthClient } from "../../services/sheetAuthClient";
import { makeSheetAuthTokenAuthorization } from "./shared";
import { SheetAuthTokenAuthorization } from "./tag";

export const SheetAuthTokenAuthorizationLiveLayer = Layer.effect(
  SheetAuthTokenAuthorization,
  pipe(
    Effect.all({
      authClient: SheetAuthClient,
      applicationOwnerResolver: ApplicationOwnerResolver,
      guildConfigService: GuildConfigService,
      membersCache: MembersApiCacheView,
      rolesCache: RolesApiCacheView,
    }),
    Effect.flatMap(
      ({ authClient, applicationOwnerResolver, guildConfigService, membersCache, rolesCache }) =>
        makeSheetAuthTokenAuthorization(
          authClient as SheetAuthClientValue,
          applicationOwnerResolver,
          guildConfigService,
          membersCache,
          rolesCache,
        ),
    ),
  ),
);

export const SheetAuthTokenAuthorizationLive = SheetAuthTokenAuthorizationLiveLayer.pipe(
  Layer.provide(
    Layer.mergeAll(
      SheetAuthClient.Default,
      GuildConfigService.Default,
      ApplicationOwnerResolver.Default,
    ),
  ),
);
