import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Effect, Layer } from "effect";
import { Api } from "@/api";
import { resolveSheetAuthGuildUser } from "@/middlewares/authorization";
import { SheetAuthTokenAuthorizationLive } from "@/middlewares/sheetAuthTokenAuthorization/live";
import { SheetAuthUser } from "@/schemas/middlewares/sheetAuthUser";

export const permissionsLayer = HttpApiBuilder.group(Api, "permissions", (handlers) => {
  return handlers.handle("getCurrentUserPermissions", ({ query }) =>
    Effect.gen(function* () {
      const user = yield* SheetAuthUser;
      const resolvedUser =
        typeof query.guildId === "string"
          ? yield* resolveSheetAuthGuildUser(user, query.guildId)
          : user;
      return {
        permissions: resolvedUser.permissions,
      };
    }),
  );
}).pipe(Layer.provide([SheetAuthTokenAuthorizationLive]));
