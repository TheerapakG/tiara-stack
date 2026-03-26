import { Data, Effect, Option, pipe } from "effect";
import { DiscordGatewayLayer } from "dfx-discord-utils/discord";
import { Interaction } from "dfx-discord-utils/utils";
import { SheetApisClient } from "./sheetApis";

export class PermissionError extends Data.TaggedError("PermissionError")<{
  readonly message: string;
}> {
  constructor(reason: string) {
    super({
      message: `You do not have permission. ${reason}`,
    });
  }
}

const resolveGuildId = (guildId?: string) =>
  Effect.gen(function* () {
    const resolvedInteractionGuildId = (yield* Interaction.guild()).pipe(
      Option.map((guild) => guild.id),
    );
    const resolvedGuildId = Option.fromNullable(guildId).pipe(
      Option.orElse(() => resolvedInteractionGuildId),
    );

    return yield* pipe(
      resolvedGuildId,
      Option.match({
        onSome: Effect.succeed,
        onNone: () =>
          Effect.fail(new PermissionError("Interaction guild or provided guild not found")),
      }),
    );
  });

export class PermissionService extends Effect.Service<PermissionService>()("PermissionService", {
  effect: Effect.gen(function* () {
    const sheetApisClient = yield* SheetApisClient;

    const getCurrentUserPermissions = Effect.fn("PermissionService.getCurrentUserPermissions")(
      (guildId?: string) =>
        sheetApisClient
          .get()
          .permissions.getCurrentUserPermissions({
            urlParams: typeof guildId === "undefined" ? {} : { guildId },
          })
          .pipe(Effect.map(({ permissions }) => permissions)),
    );

    return {
      checkInteractionInGuild: Effect.fn("PermissionService.checkInteractionUserInGuild")(
        function* (guildId?: string) {
          const resolvedInteractionGuildId = (yield* Interaction.guild()).pipe(
            Option.map((guild) => guild.id),
          );
          const resolvedGuildId = Option.fromNullable(guildId).pipe(
            Option.orElse(() => resolvedInteractionGuildId),
          );

          return Option.isSome(resolvedInteractionGuildId) && Option.isSome(resolvedGuildId)
            ? resolvedInteractionGuildId.value === resolvedGuildId.value
              ? yield* Effect.succeed(resolvedGuildId.value)
              : yield* Effect.fail(
                  new PermissionError("Interaction guild is not the same as the provided guild"),
                )
            : yield* Effect.fail(
                new PermissionError("Interaction guild or provided guild not found"),
              );
        },
      ),
      checkInteractionUserApplicationOwner: Effect.fn(
        "PermissionService.checkInteractionUserApplicationOwner",
      )(function* () {
        const resolvedAccountId = (yield* Interaction.user()).id;
        const permissions = yield* getCurrentUserPermissions();

        return permissions.includes("app_owner")
          ? yield* Effect.succeed({
              accountId: resolvedAccountId,
            })
          : yield* Effect.fail(new PermissionError("User is not the owner of the application"));
      }),
      checkInteractionUserMonitorGuild: Effect.fn(
        "PermissionService.checkInteractionUserMonitorGuild",
      )(function* (guildId?: string) {
        const resolvedAccountId = (yield* Interaction.user()).id;
        const resolvedGuildId = yield* resolveGuildId(guildId);
        const permissions = yield* getCurrentUserPermissions(resolvedGuildId);

        return permissions.some((permission) => permission === `monitor_guild:${resolvedGuildId}`)
          ? yield* Effect.succeed({ accountId: resolvedAccountId, guildId: resolvedGuildId })
          : yield* Effect.fail(new PermissionError("User does not have monitor guild permission"));
      }),
    };
  }),
  accessors: true,
  dependencies: [DiscordGatewayLayer, SheetApisClient.Default],
}) {}
