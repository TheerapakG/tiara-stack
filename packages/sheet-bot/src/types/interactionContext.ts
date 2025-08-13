import {
  AnySelectMenuInteraction,
  APIInteractionDataResolvedGuildMember,
  APIRole,
  Attachment,
  AutocompleteInteraction,
  BaseInteraction,
  ButtonInteraction,
  CacheType,
  ChannelType,
  ChatInputCommandInteraction,
  CommandInteractionOption,
  GuildMember,
  Interaction,
  InteractionDeferReplyOptions,
  InteractionEditReplyOptions,
  InteractionReplyOptions,
  MessageComponentInteraction,
  MessageContextMenuCommandInteraction,
  MessagePayload,
  MessageResolvable,
  ModalSubmitInteraction,
  PrimaryEntryPointCommandInteraction,
  RepliableInteraction,
  Role,
  Snowflake,
  User,
  UserContextMenuCommandInteraction,
} from "discord.js";
import { Context, Data, Effect, HKT, Option, pipe, Types } from "effect";

export class NotInGuildError extends Data.TaggedError("NotInGuildError")<{
  readonly message: string;
}> {
  constructor() {
    super({
      message:
        "You are not using this command in a guild. Please use this command in a guild.",
    });
  }
}

export class UncachedGuildError extends Data.TaggedError("UncachedGuildError")<{
  readonly message: string;
}> {
  constructor() {
    super({
      message:
        "This guild is not cached for some reason... Maybe try again later?",
    });
  }
}

type OptionGetterEffect<T, Required extends boolean> = Effect.Effect<
  [Required] extends [true] ? T : Option.Option<T>,
  unknown,
  InteractionContext<ChatInputCommandInteractionT>
>;

export interface ChatInputCommandInteractionT extends HKT.TypeLambda {
  readonly type: this["Target"] extends CacheType
    ? ChatInputCommandInteraction<this["Target"]>
    : ChatInputCommandInteraction;
}

export interface MessageContextMenuCommandInteractionT extends HKT.TypeLambda {
  readonly type: this["Target"] extends CacheType
    ? MessageContextMenuCommandInteraction<this["Target"]>
    : MessageContextMenuCommandInteraction;
}

export interface UserContextMenuCommandInteractionT extends HKT.TypeLambda {
  readonly type: this["Target"] extends CacheType
    ? UserContextMenuCommandInteraction<this["Target"]>
    : UserContextMenuCommandInteraction;
}

export interface PrimaryEntryPointCommandInteractionT extends HKT.TypeLambda {
  readonly type: this["Target"] extends CacheType
    ? PrimaryEntryPointCommandInteraction<this["Target"]>
    : PrimaryEntryPointCommandInteraction;
}

export interface AnySelectMenuInteractionT extends HKT.TypeLambda {
  readonly type: this["Target"] extends CacheType
    ? AnySelectMenuInteraction<this["Target"]>
    : AnySelectMenuInteraction;
}

export interface MessageComponentInteractionT extends HKT.TypeLambda {
  readonly type: this["Target"] extends CacheType
    ? MessageComponentInteraction<this["Target"]>
    : MessageComponentInteraction;
}

export interface ButtonInteractionT extends HKT.TypeLambda {
  readonly type: this["Target"] extends CacheType
    ? ButtonInteraction<this["Target"]>
    : ButtonInteraction;
}

export interface AutocompleteInteractionT extends HKT.TypeLambda {
  readonly type: this["Target"] extends CacheType
    ? AutocompleteInteraction<this["Target"]>
    : AutocompleteInteraction;
}

export interface ModalSubmitInteractionT extends HKT.TypeLambda {
  readonly type: this["Target"] extends CacheType
    ? ModalSubmitInteraction<this["Target"]>
    : ModalSubmitInteraction;
}

export interface InteractionT extends HKT.TypeLambda {
  readonly type: this["Target"] extends CacheType
    ? Interaction<this["Target"]>
    : Interaction;
}

export interface RepliableInteractionT extends HKT.TypeLambda {
  readonly type: this["Target"] extends CacheType
    ? RepliableInteraction<this["Target"]>
    : RepliableInteraction;
}

export interface BaseInteractionT extends HKT.TypeLambda {
  readonly type: this["Target"] extends CacheType
    ? BaseInteraction<this["Target"]>
    : BaseInteraction;
}

export type InteractionKind<
  F extends BaseBaseInteractionT,
  B extends CacheType = CacheType,
> = HKT.Kind<F, never, never, never, B>;

interface BaseBaseInteractionT extends HKT.TypeLambda {
  readonly type: BaseInteraction<CacheType>;
}

export class InteractionContext<I extends BaseInteractionT = InteractionT> {
  $inferInteractionType: Types.Contravariant<I> =
    undefined as unknown as Types.Contravariant<I>;

  static interaction<I extends BaseBaseInteractionT = InteractionT>() {
    return Context.GenericTag<InteractionContext<I>, InteractionKind<I>>(
      "InteractionContext",
    );
  }

  static make<I extends BaseBaseInteractionT>(interaction: InteractionKind<I>) {
    return Context.make(this.interaction<I>(), interaction);
  }

  static replied() {
    return pipe(
      InteractionContext.interaction<RepliableInteractionT>(),
      Effect.flatMap((interaction) => Effect.succeed(interaction.replied)),
    );
  }

  static deferred() {
    return pipe(
      InteractionContext.interaction<RepliableInteractionT>(),
      Effect.flatMap((interaction) => Effect.succeed(interaction.deferred)),
    );
  }

  static deferReply(options?: InteractionDeferReplyOptions) {
    return pipe(
      InteractionContext.interaction<RepliableInteractionT>(),
      Effect.flatMap((interaction) =>
        Effect.tryPromise(() => interaction.deferReply(options)),
      ),
      Effect.withSpan("InteractionContext.deferReply", {
        captureStackTrace: true,
      }),
    );
  }

  static tapDeferReply(options?: InteractionDeferReplyOptions) {
    return <A, E, R>(self: Effect.Effect<A, E, R>) =>
      pipe(
        self,
        Effect.tap(() => InteractionContext.deferReply(options)),
      );
  }

  static deferReplyWithResponse(options?: InteractionDeferReplyOptions) {
    return pipe(
      InteractionContext.interaction<RepliableInteractionT>(),
      Effect.flatMap((interaction) =>
        Effect.tryPromise(() =>
          interaction.deferReply({ ...options, withResponse: true }),
        ),
      ),
      Effect.withSpan("InteractionContext.deferReplyWithResponse", {
        captureStackTrace: true,
      }),
    );
  }

  static deleteReply(message?: MessageResolvable | "@original") {
    return pipe(
      InteractionContext.interaction<RepliableInteractionT>(),
      Effect.flatMap((interaction) =>
        Effect.tryPromise(() => interaction.deleteReply(message)),
      ),
      Effect.withSpan("InteractionContext.deleteReply", {
        captureStackTrace: true,
      }),
    );
  }

  static tapDeleteReply(message?: MessageResolvable | "@original") {
    return <A, E, R>(self: Effect.Effect<A, E, R>) =>
      pipe(
        self,
        Effect.tap(() => InteractionContext.deleteReply(message)),
      );
  }

  static editReply(
    options: string | MessagePayload | InteractionEditReplyOptions,
  ) {
    return pipe(
      InteractionContext.interaction<RepliableInteractionT>(),
      Effect.flatMap((interaction) =>
        Effect.tryPromise(() => interaction.editReply(options)),
      ),
      Effect.withSpan("InteractionContext.editReply", {
        captureStackTrace: true,
      }),
    );
  }

  static tapEditReply(
    options: string | MessagePayload | InteractionEditReplyOptions,
  ) {
    return <A, E, R>(self: Effect.Effect<A, E, R>) =>
      pipe(
        self,
        Effect.tap(() => InteractionContext.editReply(options)),
      );
  }

  static fetchReply(message?: Snowflake | "@original") {
    return pipe(
      InteractionContext.interaction<RepliableInteractionT>(),
      Effect.flatMap((interaction) =>
        Effect.tryPromise(() => interaction.fetchReply(message)),
      ),
      Effect.withSpan("InteractionContext.fetchReply", {
        captureStackTrace: true,
      }),
    );
  }

  static followUp(options: string | MessagePayload | InteractionReplyOptions) {
    return pipe(
      InteractionContext.interaction<RepliableInteractionT>(),
      Effect.flatMap((interaction) =>
        Effect.tryPromise(() => interaction.followUp(options)),
      ),
      Effect.withSpan("InteractionContext.followUp", {
        captureStackTrace: true,
      }),
    );
  }

  static tapFollowUp(
    options: string | MessagePayload | InteractionReplyOptions,
  ) {
    return <A, E, R>(self: Effect.Effect<A, E, R>) =>
      pipe(
        self,
        Effect.tap(() => InteractionContext.followUp(options)),
      );
  }

  static reply(options: string | MessagePayload | InteractionReplyOptions) {
    return pipe(
      InteractionContext.interaction<RepliableInteractionT>(),
      Effect.flatMap((interaction) =>
        Effect.tryPromise(() => interaction.reply(options)),
      ),
      Effect.withSpan("InteractionContext.reply", {
        captureStackTrace: true,
      }),
    );
  }

  static tapReply(options: string | MessagePayload | InteractionReplyOptions) {
    return <A, E, R>(self: Effect.Effect<A, E, R>) =>
      pipe(
        self,
        Effect.tap(() => InteractionContext.reply(options)),
      );
  }

  static replyWithResponse(options: InteractionReplyOptions) {
    return pipe(
      InteractionContext.interaction<RepliableInteractionT>(),
      Effect.flatMap((interaction) =>
        Effect.tryPromise(() =>
          interaction.reply({ ...options, withResponse: true }),
        ),
      ),
      Effect.withSpan("InteractionContext.replyWithResponse", {
        captureStackTrace: true,
      }),
    );
  }

  static channelId() {
    return pipe(
      InteractionContext.interaction<InteractionT>(),
      Effect.flatMap((interaction) => Effect.succeed(interaction.channelId)),
    );
  }

  static channel() {
    return pipe(
      InteractionContext.interaction<InteractionT>(),
      Effect.flatMap((interaction) => Effect.succeed(interaction.channel)),
    );
  }

  static user() {
    return pipe(
      InteractionContext.interaction<InteractionT>(),
      Effect.flatMap((interaction) => Effect.succeed(interaction.user)),
    );
  }

  static getSubcommandGroup<Required extends boolean>(required?: Required) {
    return pipe(
      InteractionContext.interaction<ChatInputCommandInteractionT>(),
      Effect.flatMap((interaction) =>
        Effect.try(() => interaction.options.getSubcommandGroup(required)),
      ),
      (e) =>
        (required
          ? e
          : pipe(e, Effect.map(Option.fromNullable))) as OptionGetterEffect<
          string,
          Required
        >,
    );
  }

  static getSubcommand<Required extends boolean>(required?: Required) {
    return pipe(
      InteractionContext.interaction<ChatInputCommandInteractionT>(),
      Effect.flatMap((interaction) =>
        Effect.try(() => interaction.options.getSubcommand(required ?? false)),
      ),
      (e) =>
        (required
          ? e
          : pipe(e, Effect.map(Option.fromNullable))) as OptionGetterEffect<
          string,
          Required
        >,
    );
  }

  static getBoolean<Required extends boolean>(
    name: string,
    required?: Required,
  ) {
    return pipe(
      InteractionContext.interaction<ChatInputCommandInteractionT>(),
      Effect.flatMap((interaction) =>
        Effect.try(() => interaction.options.getBoolean(name, required)),
      ),
      (e) =>
        (required
          ? e
          : pipe(e, Effect.map(Option.fromNullable))) as OptionGetterEffect<
          boolean,
          Required
        >,
    );
  }

  static getChannel<
    Required extends boolean,
    const Type extends ChannelType = ChannelType,
  >(name: string, required?: Required, channelTypes?: readonly Type[]) {
    return pipe(
      InteractionContext.interaction<ChatInputCommandInteractionT>(),
      Effect.flatMap((interaction) =>
        Effect.try(() =>
          interaction.options.getChannel(name, required, channelTypes),
        ),
      ),
      (e) =>
        (required
          ? e
          : pipe(e, Effect.map(Option.fromNullable))) as OptionGetterEffect<
          Extract<
            NonNullable<CommandInteractionOption["channel"]>,
            {
              type: Type extends
                | ChannelType.PublicThread
                | ChannelType.AnnouncementThread
                ? ChannelType.PublicThread | ChannelType.AnnouncementThread
                : Type;
            }
          >,
          Required
        >,
    );
  }

  static getString<Required extends boolean>(
    name: string,
    required?: Required,
  ) {
    return pipe(
      InteractionContext.interaction<ChatInputCommandInteractionT>(),
      Effect.flatMap((interaction) =>
        Effect.try(() => interaction.options.getString(name, required)),
      ),
      (e) =>
        (required
          ? e
          : pipe(e, Effect.map(Option.fromNullable))) as OptionGetterEffect<
          string,
          Required
        >,
    );
  }

  static getInteger<Required extends boolean>(
    name: string,
    required?: Required,
  ) {
    return pipe(
      InteractionContext.interaction<ChatInputCommandInteractionT>(),
      Effect.flatMap((interaction) =>
        Effect.try(() => interaction.options.getInteger(name, required)),
      ),
      (e) =>
        (required
          ? e
          : pipe(e, Effect.map(Option.fromNullable))) as OptionGetterEffect<
          number,
          Required
        >,
    );
  }

  static getNumber<Required extends boolean>(
    name: string,
    required?: Required,
  ) {
    return pipe(
      InteractionContext.interaction<ChatInputCommandInteractionT>(),
      Effect.flatMap((interaction) =>
        Effect.try(() => interaction.options.getNumber(name, required)),
      ),
      (e) =>
        (required
          ? e
          : pipe(e, Effect.map(Option.fromNullable))) as OptionGetterEffect<
          number,
          Required
        >,
    );
  }

  static getUser<Required extends boolean>(name: string, required?: Required) {
    return pipe(
      InteractionContext.interaction<ChatInputCommandInteractionT>(),
      Effect.flatMap((interaction) =>
        Effect.try(() => interaction.options.getUser(name, required)),
      ),
      (e) =>
        (required
          ? e
          : pipe(e, Effect.map(Option.fromNullable))) as OptionGetterEffect<
          User,
          Required
        >,
    );
  }

  static getMember<Required extends boolean>(
    name: string,
    required?: Required,
  ) {
    return pipe(
      InteractionContext.interaction<ChatInputCommandInteractionT>(),
      Effect.flatMap((interaction) =>
        Effect.try(() => interaction.options.getMember(name)),
      ),
      (e) =>
        (required
          ? e
          : pipe(e, Effect.map(Option.fromNullable))) as OptionGetterEffect<
          GuildMember | APIInteractionDataResolvedGuildMember,
          Required
        >,
    );
  }

  static getRole<Required extends boolean>(name: string, required?: Required) {
    return pipe(
      InteractionContext.interaction<ChatInputCommandInteractionT>(),
      Effect.flatMap((interaction) =>
        Effect.try(() => interaction.options.getRole(name, required)),
      ),
      (e) =>
        (required
          ? e
          : pipe(e, Effect.map(Option.fromNullable))) as OptionGetterEffect<
          Role | APIRole,
          Required
        >,
    );
  }

  static getAttachment<Required extends boolean>(
    name: string,
    required?: Required,
  ) {
    return pipe(
      InteractionContext.interaction<ChatInputCommandInteractionT>(),
      Effect.flatMap((interaction) =>
        Effect.try(() => interaction.options.getAttachment(name, required)),
      ),
      (e) =>
        (required
          ? e
          : pipe(e, Effect.map(Option.fromNullable))) as OptionGetterEffect<
          Attachment,
          Required
        >,
    );
  }

  static getMentionable<Required extends boolean>(
    name: string,
    required?: Required,
  ) {
    return pipe(
      InteractionContext.interaction<ChatInputCommandInteractionT>(),
      Effect.flatMap((interaction) =>
        Effect.try(() => interaction.options.getMentionable(name, required)),
      ),
      (e) =>
        (required
          ? e
          : pipe(e, Effect.map(Option.fromNullable))) as OptionGetterEffect<
          | GuildMember
          | APIInteractionDataResolvedGuildMember
          | Role
          | APIRole
          | User,
          Required
        >,
    );
  }
}

interface BaseMessageInteractionT extends HKT.TypeLambda {
  readonly type:
    | MessageComponentInteraction<CacheType>
    | ModalSubmitInteraction<CacheType>;
}

export class CachedInteractionContext {
  static interaction<
    I extends BaseBaseInteractionT = InteractionT,
    Kind extends InteractionKind<I, "cached"> = InteractionKind<I, "cached">,
  >() {
    return pipe(
      InteractionContext.interaction<I>(),
      Effect.flatMap((interaction) =>
        !interaction.inGuild()
          ? Effect.fail(new NotInGuildError())
          : Effect.succeed(interaction),
      ),
      Effect.flatMap((interaction) =>
        !interaction.inCachedGuild()
          ? Effect.fail(new UncachedGuildError())
          : Effect.succeed(interaction as Kind),
      ),
    );
  }

  static message<
    I extends BaseMessageInteractionT,
    Kind extends InteractionKind<I, "cached"> = InteractionKind<I, "cached">,
  >() {
    return pipe(
      CachedInteractionContext.interaction<I, Kind>(),
      Effect.flatMap((interaction) =>
        Effect.succeed(interaction.message as Kind["message"]),
      ),
    );
  }

  static channel() {
    return pipe(
      CachedInteractionContext.interaction<InteractionT>(),
      Effect.flatMap((interaction) => Effect.succeed(interaction.channel)),
    );
  }

  static guildId() {
    return pipe(
      CachedInteractionContext.interaction<InteractionT>(),
      Effect.flatMap((interaction) => Effect.succeed(interaction.guildId)),
    );
  }

  static guild() {
    return pipe(
      CachedInteractionContext.interaction<InteractionT>(),
      Effect.flatMap((interaction) => Effect.try(() => interaction.guild)),
    );
  }

  static getChannel<
    Required extends boolean,
    const Type extends ChannelType = ChannelType,
  >(name: string, required?: Required, channelTypes?: readonly Type[]) {
    return pipe(
      CachedInteractionContext.interaction<ChatInputCommandInteractionT>(),
      Effect.flatMap((interaction) =>
        Effect.try(() =>
          interaction.options.getChannel(name, required, channelTypes),
        ),
      ),
      (e) =>
        (required
          ? e
          : pipe(e, Effect.map(Option.fromNullable))) as OptionGetterEffect<
          Extract<
            NonNullable<CommandInteractionOption<"cached">["channel"]>,
            {
              type: Type extends
                | ChannelType.PublicThread
                | ChannelType.AnnouncementThread
                ? ChannelType.PublicThread | ChannelType.AnnouncementThread
                : Type;
            }
          >,
          Required
        >,
    );
  }

  static getMember<Required extends boolean>(
    name: string,
    required?: Required,
  ) {
    return pipe(
      CachedInteractionContext.interaction<ChatInputCommandInteractionT>(),
      Effect.flatMap((interaction) =>
        Effect.try(() => interaction.options.getMember(name)),
      ),
      (e) =>
        (required
          ? e
          : pipe(e, Effect.map(Option.fromNullable))) as OptionGetterEffect<
          GuildMember,
          Required
        >,
    );
  }

  static getRole<Required extends boolean>(name: string, required?: Required) {
    return pipe(
      CachedInteractionContext.interaction<ChatInputCommandInteractionT>(),
      Effect.flatMap((interaction) =>
        Effect.try(() => interaction.options.getRole(name, required)),
      ),
      (e) =>
        (required
          ? e
          : pipe(e, Effect.map(Option.fromNullable))) as OptionGetterEffect<
          Role,
          Required
        >,
    );
  }

  static getMentionable<Required extends boolean>(
    name: string,
    required?: Required,
  ) {
    return pipe(
      CachedInteractionContext.interaction<ChatInputCommandInteractionT>(),
      Effect.flatMap((interaction) =>
        Effect.try(() => interaction.options.getMentionable(name, required)),
      ),
      (e) =>
        (required
          ? e
          : pipe(e, Effect.map(Option.fromNullable))) as OptionGetterEffect<
          GuildMember | Role | User,
          Required
        >,
    );
  }
}
