import { HttpApiBuilder } from "@effect/platform";
import { Effect, Layer } from "effect";
import { Api } from "@/api";
import { resolveUserGuildPermissions } from "@/middlewares/authorization";
import { SheetAuthTokenAuthorizationLive } from "@/middlewares/sheetAuthTokenAuthorization/live";
import { SheetAuthUser } from "@/schemas/middlewares/sheetAuthUser";
import { GuildConfigService } from "@/services/guildConfig";

export const PermissionsLive = HttpApiBuilder.group(Api, "permissions", (handlers) =>
  handlers.handle("getCurrentUserPermissions", ({ urlParams }) =>
    Effect.gen(function* () {
      const user = yield* SheetAuthUser;
      const resolvedUser =
        typeof urlParams.guildId === "string"
          ? yield* resolveUserGuildPermissions(user, urlParams.guildId)
          : user;
      return {
        permissions: resolvedUser.permissions,
      };
    }),
  ),
).pipe(Layer.provide(Layer.mergeAll(GuildConfigService.Default, SheetAuthTokenAuthorizationLive)));
