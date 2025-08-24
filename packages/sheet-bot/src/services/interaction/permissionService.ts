import { GuildService } from "@/services/guild";
import { bindObject, wrap } from "@/utils";
import {
  PermissionResolvable,
  PermissionsBitField,
  RoleResolvable,
} from "discord.js";
import { Data, Effect, Equal, pipe } from "effect";
import { ClientService } from "./clientService";
import {
  CachedInteractionContext,
  InteractionContext,
  InteractionT,
} from "./interactionContext";

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
      bindObject({
        interaction: pipe(
          InteractionContext.interaction<InteractionT>().sync(),
          Effect.either,
        ),
        cachedInteraction: pipe(
          CachedInteractionContext.interaction<InteractionT>().sync(),
          Effect.either,
        ),
        client: ClientService.getClient(),
      }),
      Effect.map(({ interaction, cachedInteraction, client }) => ({
        privateCheckOwner: ({ allowSameGuild }: { allowSameGuild?: boolean }) =>
          pipe(
            Effect.fail(new OwnerError()),
            Effect.unlessEffect(
              pipe(
                Effect.Do,
                InteractionContext.guildId().bind("interactionGuildId"),
                InteractionContext.user.bind("interactionUser"),
                bindObject({
                  guildGuildId: pipe(
                    Effect.serviceOption(GuildService),
                    Effect.flatMap(
                      Effect.transposeMapOption((guildService) =>
                        guildService.getId(),
                      ),
                    ),
                  ),
                }),
                Effect.map(
                  ({ interactionUser, interactionGuildId, guildGuildId }) =>
                    (allowSameGuild &&
                      Equal.equals(interactionGuildId, guildGuildId)) ||
                    interactionUser.id === client.application.owner?.id,
                ),
              ),
            ),
            Effect.asVoid,
            Effect.withSpan("PermissionService.checkOwner", {
              captureStackTrace: true,
            }),
          ),
        privateCheckPermissions: ({
          permissions,
          reason,
        }: {
          permissions: PermissionResolvable;
          reason?: string;
        }) =>
          pipe(
            Effect.fail(
              new PermissionError(
                reason ??
                  `You do not have permission for ${new PermissionsBitField(permissions).toArray().join(", ")} to use this command`,
              ),
            ),
            Effect.unlessEffect(
              pipe(
                interaction,
                Effect.map(
                  (interaction) =>
                    interaction.memberPermissions?.has(permissions) ?? false,
                ),
              ),
            ),
            Effect.asVoid,
            Effect.withSpan("PermissionService.checkPermissions", {
              captureStackTrace: true,
            }),
          ),
        privateCheckRoles: ({
          roles,
          reason,
        }: {
          roles: RoleResolvable[];
          reason?: string;
        }) =>
          pipe(
            Effect.fail(
              new PermissionError(
                reason ?? `You do not have necessary role to use this command`,
              ),
            ),
            Effect.unlessEffect(
              pipe(
                cachedInteraction,
                Effect.map((interaction) =>
                  interaction.member.roles.cache.some((role) =>
                    roles
                      .map((role) => interaction.guild.roles.resolveId(role))
                      .includes(role.id),
                  ),
                ),
              ),
            ),
            Effect.unlessEffect(
              pipe(
                interaction,
                Effect.map(
                  (interaction) =>
                    interaction.user.id === client.application.owner?.id,
                ),
              ),
            ),
            Effect.asVoid,
            Effect.withSpan("PermissionService.checkRoles", {
              captureStackTrace: true,
            }),
          ),
        privateAddRole: (roleId: string) =>
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
  static checkOwner = wrap(PermissionService.privateCheckOwner);
  static checkPermissions = wrap(PermissionService.privateCheckPermissions);
  static checkRoles = wrap(PermissionService.privateCheckRoles);
  static addRole = wrap(PermissionService.privateAddRole);
}
