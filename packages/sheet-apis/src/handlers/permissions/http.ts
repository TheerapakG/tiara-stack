import { HttpApiBuilder } from "@effect/platform";
import { Effect, Layer } from "effect";
import { Api } from "@/api";
import { SheetAuthTokenAuthorizationLive } from "@/middlewares/sheetAuthTokenAuthorization/live";
import { SheetAuthUser } from "@/schemas/middlewares/sheetAuthUser";

export const PermissionsLive = HttpApiBuilder.group(Api, "permissions", (handlers) =>
  handlers.handle("getCurrentUserPermissions", () =>
    Effect.gen(function* () {
      const user = yield* SheetAuthUser;
      return {
        permissions: user.permissions,
      };
    }),
  ),
).pipe(Layer.provide(SheetAuthTokenAuthorizationLive));
