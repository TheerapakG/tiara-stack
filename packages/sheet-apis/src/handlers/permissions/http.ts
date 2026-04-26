import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Effect, Layer } from "effect";
import { Api } from "@/api";
import { SheetAuthTokenAuthorizationLive } from "@/middlewares/sheetAuthTokenAuthorization/live";
import { makeResolveSheetAuthUserFromToken } from "@/middlewares/sheetAuthTokenAuthorization/shared";
import { ApplicationOwnerResolver } from "@/services/applicationOwner";
import { SheetAuthClient } from "@/services/sheetAuthClient";
import { SheetAuthUser } from "sheet-ingress-api/schemas/middlewares/sheetAuthUser";
import { AuthorizationService } from "@/services";

export const permissionsLayer = HttpApiBuilder.group(
  Api,
  "permissions",
  Effect.fn(function* (handlers) {
    const authorizationService = yield* AuthorizationService;
    const sheetAuthClient = yield* SheetAuthClient;
    const applicationOwnerResolver = yield* ApplicationOwnerResolver;
    const resolveSheetAuthUserFromToken = yield* makeResolveSheetAuthUserFromToken(
      sheetAuthClient,
      applicationOwnerResolver,
    );

    return handlers
      .handle(
        "getCurrentUserPermissions",
        Effect.fnUntraced(function* ({ query }) {
          const resolvedUser =
            typeof query.guildId === "string"
              ? yield* authorizationService.resolveCurrentGuildUser(query.guildId)
              : yield* SheetAuthUser;
          return {
            permissions: resolvedUser.permissions,
          };
        }),
      )
      .handle(
        "resolveTokenPermissions",
        Effect.fnUntraced(function* ({ payload }) {
          yield* authorizationService.requireService();
          const user = yield* resolveSheetAuthUserFromToken(payload.token);
          const resolvedUser =
            typeof payload.guildId === "string"
              ? yield* authorizationService.resolveSheetAuthGuildUser(user, payload.guildId)
              : user;

          return {
            accountId: resolvedUser.accountId,
            userId: resolvedUser.userId,
            permissions: resolvedUser.permissions,
          };
        }),
      );
  }),
).pipe(
  Layer.provide([
    ApplicationOwnerResolver.layer,
    AuthorizationService.layer,
    SheetAuthClient.layer,
    SheetAuthTokenAuthorizationLive,
  ]),
);
