import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Effect, Layer } from "effect";
import { Api } from "@/api";
import { SheetAuthTokenAuthorizationLive } from "@/middlewares/sheetAuthTokenAuthorization/live";
import { SheetAuthUser } from "@/schemas/middlewares/sheetAuthUser";
import { AuthorizationService } from "@/services";

export const permissionsLayer = HttpApiBuilder.group(
  Api,
  "permissions",
  Effect.fn(function* (handlers) {
    const authorizationService = yield* AuthorizationService;

    return handlers.handle("getCurrentUserPermissions", ({ query }) =>
      Effect.gen(function* () {
        const user = yield* SheetAuthUser;
        const resolvedUser =
          typeof query.guildId === "string"
            ? yield* authorizationService.resolveSheetAuthGuildUser(user, query.guildId)
            : user;
        return {
          permissions: resolvedUser.permissions,
        };
      }),
    );
  }),
).pipe(Layer.provide([AuthorizationService.layer, SheetAuthTokenAuthorizationLive]));
