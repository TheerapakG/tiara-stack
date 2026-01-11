import { wrap, wrapOptional } from "@/utils";
import { GuildMember, RoleResolvable } from "discord.js";
import { Context, Effect, HKT, pipe, Types } from "effect";
import { DiscordError } from "~~/src/types/error";

export interface GuildMemberT extends HKT.TypeLambda {
  readonly type: GuildMember;
}

export type GuildMemberKind<F extends BaseGuildMemberT> = HKT.Kind<F, never, never, never, never>;

export interface BaseGuildMemberT extends HKT.TypeLambda {
  readonly type: GuildMember;
}

export class GuildMemberContext<M extends BaseGuildMemberT = GuildMemberT> {
  $inferGuildMemberType: Types.Contravariant<M> = undefined as unknown as Types.Contravariant<M>;

  static guildMemberTag = <M extends BaseGuildMemberT = GuildMemberT>() =>
    Context.GenericTag<GuildMemberContext<M>, GuildMemberKind<M>>("GuildMemberContext");

  static guildMember = <M extends BaseGuildMemberT = GuildMemberT>() =>
    wrapOptional(() => GuildMemberContext.guildMemberTag<M>());

  static make = <M extends BaseGuildMemberT = GuildMemberT>(member: GuildMemberKind<M>) =>
    Context.make(this.guildMemberTag<M>(), member);

  static addRoles = wrap((roleOrRoles: RoleResolvable | readonly RoleResolvable[]) =>
    pipe(
      GuildMemberContext.guildMember<GuildMemberT>().sync(),
      Effect.flatMap((member) => DiscordError.wrapTryPromise(() => member.roles.add(roleOrRoles))),
      Effect.withSpan("GuildMemberContext.addRoles", {
        captureStackTrace: true,
      }),
    ),
  );

  static setRoles = wrap((roles: readonly RoleResolvable[]) =>
    pipe(
      GuildMemberContext.guildMember<GuildMemberT>().sync(),
      Effect.flatMap((member) => DiscordError.wrapTryPromise(() => member.roles.set(roles))),
      Effect.withSpan("GuildMemberContext.setRoles", {
        captureStackTrace: true,
      }),
    ),
  );

  static removeRoles = wrap((roleOrRoles: RoleResolvable | readonly RoleResolvable[]) =>
    pipe(
      GuildMemberContext.guildMember<GuildMemberT>().sync(),
      Effect.flatMap((member) =>
        DiscordError.wrapTryPromise(() => member.roles.remove(roleOrRoles)),
      ),
      Effect.withSpan("GuildMemberContext.removeRoles", {
        captureStackTrace: true,
      }),
    ),
  );
}
