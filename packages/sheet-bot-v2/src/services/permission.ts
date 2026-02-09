import { Data, Effect, Option, pipe } from "effect";
import { DiscordREST, Perms } from "dfx";
import { GuildsCache, RolesCache } from "../discord/cache";
import { DiscordApplication, DiscordGatewayLayer } from "../discord/gateway";
import { Interaction } from "@/utils";

export class PermissionError extends Data.TaggedError("PermissionError")<{
  readonly message: string;
}> {
  constructor(reason: string) {
    super({
      message: `You do not have permission. ${reason}`,
    });
  }
}

export class PermissionService extends Effect.Service<PermissionService>()("PermissionService", {
  effect: Effect.gen(function* () {
    const rest = yield* DiscordREST;
    const application = yield* DiscordApplication;
    const guildsCache = yield* GuildsCache;
    const rolesCache = yield* RolesCache;

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
        const resolvedUserId = (yield* Interaction.user()).id;

        return resolvedUserId === application.owner.id
          ? yield* Effect.succeed({
              userId: resolvedUserId,
            })
          : yield* Effect.fail(new PermissionError("User is not the owner of the application"));
      }),
      checkInteractionUserGuildOwner: Effect.fn("PermissionService.checkInteractionUserGuildOwner")(
        function* (guildId?: string) {
          const resolvedUserId = (yield* Interaction.user()).id;
          const resolvedInteractionGuildId = (yield* Interaction.guild()).pipe(
            Option.map((guild) => guild.id),
          );
          const resolvedGuildId = Option.fromNullable(guildId).pipe(
            Option.orElse(() => resolvedInteractionGuildId),
          );
          const resolvedGuild = yield* Effect.transposeMapOption(resolvedGuildId, guildsCache.get);

          return Option.isSome(resolvedGuild)
            ? resolvedUserId === resolvedGuild.value.owner_id
              ? yield* Effect.succeed({
                  userId: resolvedUserId,
                  guild: resolvedGuild.value,
                })
              : yield* Effect.fail(new PermissionError("User is not the owner of the guild"))
            : yield* Effect.fail(new PermissionError("Guild not found"));
        },
      ),
      checkInteractionUserGuildPermissions: Effect.fn(
        "PermissionService.checkInteractionUserGuildPermissions",
      )(function* (permissions: string | bigint, guildId?: string) {
        const resolvedUserId = (yield* Interaction.user()).id;
        const resolvedInteractionGuildId = (yield* Interaction.guild()).pipe(
          Option.map((guild) => guild.id),
        );
        const resolvedGuildId = Option.fromNullable(guildId).pipe(
          Option.orElse(() => resolvedInteractionGuildId),
        );

        const resolvedUserPermissions = guildId
          ? Option.some<string | bigint>(
              Perms.forMember([...(yield* rolesCache.getForParent(guildId)).values()])(
                yield* pipe(
                  rest.getGuildMember(guildId, resolvedUserId),
                  Effect.catchTag("ErrorResponse", () =>
                    Effect.fail(new PermissionError("User is not in the guild")),
                  ),
                ),
              ),
            )
          : (yield* Interaction.member()).pipe(Option.map((member) => member.permissions));

        return Option.isSome(resolvedGuildId) &&
          Option.isSome(resolvedUserPermissions) &&
          Perms.has(permissions)(resolvedUserPermissions.value)
          ? yield* Effect.succeed({ userId: resolvedUserId, guildId: resolvedGuildId.value })
          : yield* Effect.fail(new PermissionError("User does not have permissions"));
      }),
      checkInteractionUserGuildRoles: Effect.fn("PermissionService.checkInteractionUserGuildRoles")(
        function* (roles: string[], guildId?: string) {
          const resolvedUserId = (yield* Interaction.user()).id;
          const resolvedInteractionGuildId = (yield* Interaction.guild()).pipe(
            Option.map((guild) => guild.id),
          );
          const resolvedGuildId = Option.fromNullable(guildId).pipe(
            Option.orElse(() => resolvedInteractionGuildId),
          );
          const resolvedUserRoles = Option.isSome(resolvedGuildId)
            ? Option.some<readonly string[]>(
                (yield* pipe(
                  rest.getGuildMember(resolvedGuildId.value, resolvedUserId),
                  Effect.catchTag("ErrorResponse", () =>
                    Effect.fail(new PermissionError("User is not in the guild")),
                  ),
                )).roles,
              )
            : Option.none();

          return Option.isSome(resolvedGuildId) &&
            Option.isSome(resolvedUserRoles) &&
            resolvedUserRoles.value.some((role) => roles.includes(role))
            ? yield* Effect.succeed({
                userId: resolvedUserId,
                guildId: resolvedGuildId.value,
              })
            : yield* Effect.fail(new PermissionError("User does not have roles"));
        },
      ),
    };
  }),
  accessors: true,
  dependencies: [DiscordGatewayLayer, GuildsCache.Default, RolesCache.Default],
}) {}
