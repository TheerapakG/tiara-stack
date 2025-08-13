import {
  PermissionResolvable,
  PermissionsBitField,
  RoleResolvable,
} from "discord.js";
import { Data, Effect, Option, pipe } from "effect";
import {
  CachedInteractionContext,
  InteractionContext,
  InteractionT,
} from "../../types";
import { GuildService } from "../guild";
import { ClientService } from "./clientService";

export class OwnerError extends Data.TaggedError("OwnerError")<{
  readonly message: string;
}> {
  constructor() {
    super({
      message: "You cannot perm abuse like the owner of the bot.",
    });
  }
}

export class PermissionError extends Data.TaggedError("PermissionError")<{
  readonly message: string;
}> {
  constructor(reason: string) {
    super({
      message: `You do not have permission. ${reason}`,
    });
  }
}

export class PermissionService extends Effect.Service<PermissionService>()(
  "PermissionService",
  {
    effect: pipe(
      Effect.Do,
      Effect.bindAll(
        () => ({
          interaction: pipe(
            InteractionContext.interaction<InteractionT>(),
            Effect.either,
          ),
          cachedInteraction: pipe(
            CachedInteractionContext.interaction<InteractionT>(),
            Effect.either,
          ),
          client: ClientService.getClient(),
        }),
        { concurrency: "unbounded" },
      ),
      Effect.map(({ interaction, cachedInteraction, client }) => ({
        checkOwner: ({ allowSameGuild }: { allowSameGuild?: boolean }) =>
          pipe(
            Effect.Do,
            Effect.bindAll(() => ({
              interaction,
              guild: pipe(
                Effect.serviceOption(GuildService),
                Effect.flatMap(
                  Option.match({
                    onSome: (guildService) =>
                      pipe(guildService.getGuild(), Effect.map(Option.some)),
                    onNone: () => Effect.succeed(Option.none()),
                  }),
                ),
              ),
            })),
            Effect.let("sameGuild", ({ interaction, guild }) =>
              pipe(
                guild,
                Option.map((guild) => guild.id),
                Option.getOrNull,
                (guildId) => guildId === interaction.guildId,
              ),
            ),
            Effect.flatMap(({ interaction, sameGuild }) =>
              (allowSameGuild && sameGuild) ||
              interaction.user.id === client.application.owner?.id
                ? Effect.void
                : Effect.fail(new OwnerError()),
            ),
            Effect.withSpan("PermissionService.checkOwner", {
              captureStackTrace: true,
            }),
          ),
        checkPermissions: (
          permissions: PermissionResolvable,
          reason?: string,
        ) =>
          pipe(
            interaction,
            Effect.flatMap((interaction) =>
              interaction.memberPermissions?.has(permissions)
                ? Effect.void
                : Effect.fail(
                    new PermissionError(
                      reason ??
                        `You do not have permission for ${new PermissionsBitField(permissions).toArray().join(", ")} to use this command`,
                    ),
                  ),
            ),
            Effect.withSpan("PermissionService.checkPermissions", {
              captureStackTrace: true,
            }),
          ),
        checkRoles: (roles: RoleResolvable[], reason?: string) =>
          pipe(
            interaction,
            Effect.flatMap((interaction) =>
              interaction.user.id === client.application.owner?.id
                ? Effect.void
                : pipe(
                    cachedInteraction,
                    Effect.flatMap((interaction) =>
                      interaction.member.roles.cache.some((role) =>
                        roles
                          .map((role) =>
                            interaction.guild.roles.resolveId(role),
                          )
                          .includes(role.id),
                      )
                        ? Effect.void
                        : Effect.fail(
                            new PermissionError(
                              reason ??
                                `You do not have necessary role to use this command`,
                            ),
                          ),
                    ),
                  ),
            ),
            Effect.withSpan("PermissionService.checkRoles", {
              captureStackTrace: true,
            }),
          ),
        addRole: (roleId: string) =>
          pipe(
            cachedInteraction,
            Effect.flatMap((interaction) =>
              Effect.tryPromise(() => interaction.member.roles.add(roleId)),
            ),
            Effect.withSpan("PermissionService.addRole", {
              captureStackTrace: true,
            }),
          ),
      })),
    ),
    accessors: true,
  },
) {
  static tapCheckOwner({ allowSameGuild }: { allowSameGuild?: boolean }) {
    return <A, E, R>(self: Effect.Effect<A, E, R>) =>
      pipe(
        self,
        Effect.tap(() => PermissionService.checkOwner({ allowSameGuild })),
      );
  }

  static tapCheckPermissions(
    permissions: PermissionResolvable,
    reason?: string,
  ) {
    return <A, E, R>(self: Effect.Effect<A, E, R>) =>
      pipe(
        self,
        Effect.tap(() =>
          PermissionService.checkPermissions(permissions, reason),
        ),
      );
  }

  static tapCheckRoles<E1, R1>(
    roles: Effect.Effect<RoleResolvable[], E1, R1>,
    reason?: string,
  ) {
    return <A, E2, R2>(self: Effect.Effect<A, E2, R2>) =>
      pipe(
        Effect.Do,
        Effect.bindAll(
          () => ({
            self,
            roles: pipe(
              roles,
              Effect.tap((roles) =>
                PermissionService.checkRoles(roles, reason),
              ),
            ),
          }),
          { concurrency: "unbounded" },
        ),
        Effect.map(({ self }) => self),
      );
  }

  static tapAddRole(roleId: string) {
    return <A, E, R>(self: Effect.Effect<A, E, R>) =>
      pipe(
        self,
        Effect.tap(() => PermissionService.addRole(roleId)),
      );
  }
}
