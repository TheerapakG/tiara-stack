import { HttpMiddleware, HttpServerRequest } from "@effect/platform";
import { Effect, HashSet, Schema } from "effect";
import { getAccount } from "sheet-auth/client";
import { MembersApiCacheView } from "dfx-discord-utils/discord";
import { SheetAuthUser } from "./sheetAuthTokenAuthorization/tag";
import { Unauthorized } from "@/schemas/middlewares/unauthorized";
import { GuildConfigService, SheetAuthClient } from "@/services";

export const SheetAuthUserGuildMonitorsAuthorization = HttpMiddleware.make(
  Effect.fnUntraced(function* (handler) {
    const user = yield* SheetAuthUser;

    if (user.permissions?.includes("bot:manage_guild")) {
      return yield* handler;
    }

    const { guildId } = yield* HttpServerRequest.schemaSearchParams(
      Schema.Struct({ guildId: Schema.String }),
    ).pipe(
      Effect.mapError(
        () => new Unauthorized({ message: "Missing required query parameter: guildId" }),
      ),
    );

    const authClient = yield* SheetAuthClient;
    const account = yield* getAccount(authClient, ["discord", "kubernetes:discord"], {
      Authorization: `Bearer ${user.token}`,
    }).pipe(
      Effect.mapError(
        (error) =>
          new Unauthorized({ message: `Failed to retrieve linked account: ${error.message}` }),
      ),
    );

    const membersCache = yield* MembersApiCacheView;
    const guildConfigService = yield* GuildConfigService;

    const member = yield* membersCache
      .get(guildId, account.accountId)
      .pipe(
        Effect.mapError(() => new Unauthorized({ message: "User is not a member of the guild" })),
      );
    const roles = yield* guildConfigService
      .getGuildManagerRoles(guildId)
      .pipe(
        Effect.mapError(
          () => new Unauthorized({ message: "Failed to retrieve guild manager roles" }),
        ),
      );

    if (
      HashSet.intersection(
        HashSet.fromIterable(member.roles),
        HashSet.fromIterable(roles.map((role) => role.roleId)),
      ).pipe(HashSet.size) === 0
    ) {
      return yield* Effect.fail(new Unauthorized({ message: "User is not a guild manager" }));
    }

    return yield* handler;
  }, Effect.provide(SheetAuthClient.Default)),
);
