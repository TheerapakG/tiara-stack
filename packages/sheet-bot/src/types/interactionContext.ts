import {
  APIInteractionDataResolvedGuildMember,
  APIRole,
  Attachment,
  ChannelType,
  ChatInputCommandInteraction,
  CommandInteractionOption,
  GuildMember,
  Interaction,
  InteractionDeferReplyOptions,
  InteractionEditReplyOptions,
  InteractionReplyOptions,
  MessagePayload,
  MessageResolvable,
  RepliableInteraction,
  Role,
  Snowflake,
  User,
} from "discord.js";
import { Context, Data, Effect, Option, pipe } from "effect";

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
  InteractionContext<ChatInputCommandInteraction>
>;

export class InteractionContext<I extends Interaction = Interaction> {
  $inferInteractionType: I = undefined as unknown as I;

  static interaction<I extends Interaction = Interaction>() {
    return Context.GenericTag<InteractionContext<I>, I>("InteractionContext");
  }

  static make<I extends Interaction>(interaction: I) {
    return Context.make(this.interaction<I>(), interaction);
  }

  static deferReply(options?: InteractionDeferReplyOptions) {
    return pipe(
      InteractionContext.interaction<RepliableInteraction>(),
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
      InteractionContext.interaction<RepliableInteraction>(),
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
      InteractionContext.interaction<RepliableInteraction>(),
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
      InteractionContext.interaction<RepliableInteraction>(),
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
      InteractionContext.interaction<RepliableInteraction>(),
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
      InteractionContext.interaction<RepliableInteraction>(),
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
      InteractionContext.interaction<RepliableInteraction>(),
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
      InteractionContext.interaction<RepliableInteraction>(),
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

  static getBoolean<Required extends boolean>(
    name: string,
    required?: Required,
  ) {
    return pipe(
      InteractionContext.interaction<ChatInputCommandInteraction>(),
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
      InteractionContext.interaction<ChatInputCommandInteraction>(),
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
      InteractionContext.interaction<ChatInputCommandInteraction>(),
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
      InteractionContext.interaction<ChatInputCommandInteraction>(),
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
      InteractionContext.interaction<ChatInputCommandInteraction>(),
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
      InteractionContext.interaction<ChatInputCommandInteraction>(),
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
      InteractionContext.interaction<ChatInputCommandInteraction>(),
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
      InteractionContext.interaction<ChatInputCommandInteraction>(),
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
      InteractionContext.interaction<ChatInputCommandInteraction>(),
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
      InteractionContext.interaction<ChatInputCommandInteraction>(),
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

export class CachedInteractionContext {
  static interaction<I extends Interaction = Interaction>() {
    return pipe(
      InteractionContext.interaction<I>(),
      Effect.flatMap((interaction) =>
        pipe(
          !interaction.inGuild()
            ? Effect.fail<NotInGuildError | UncachedGuildError>(
                new NotInGuildError(),
              )
            : !interaction.inCachedGuild()
              ? Effect.fail(new UncachedGuildError())
              : Effect.succeed(interaction),
        ),
      ),
    );
  }

  static getChannel<
    Required extends boolean,
    const Type extends ChannelType = ChannelType,
  >(name: string, required?: Required, channelTypes?: readonly Type[]) {
    return pipe(
      CachedInteractionContext.interaction<ChatInputCommandInteraction>(),
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
      CachedInteractionContext.interaction<ChatInputCommandInteraction>(),
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
      InteractionContext.interaction<ChatInputCommandInteraction>(),
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
      CachedInteractionContext.interaction<ChatInputCommandInteraction>(),
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
