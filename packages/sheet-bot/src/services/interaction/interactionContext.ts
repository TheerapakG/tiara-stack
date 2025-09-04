import { wrap, wrapOptional } from "@/utils";
import {
  AnySelectMenuInteraction,
  AutocompleteInteraction,
  BaseInteraction,
  ButtonInteraction,
  CacheType,
  ChannelType,
  ChatInputCommandInteraction,
  Interaction,
  InteractionDeferReplyOptions,
  InteractionDeferUpdateOptions,
  InteractionEditReplyOptions,
  InteractionReplyOptions,
  InteractionUpdateOptions,
  MessageComponentInteraction,
  MessageContextMenuCommandInteraction,
  MessagePayload,
  MessageResolvable,
  ModalSubmitInteraction,
  PrimaryEntryPointCommandInteraction,
  RepliableInteraction,
  Snowflake,
  UserContextMenuCommandInteraction,
  UserSelectMenuInteraction,
} from "discord.js";
import { Context, Data, Effect, HKT, Option, pipe, Types } from "effect";
import { DiscordError, NotInGuildError } from "~~/src/types";

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

export class MissingChannelError extends Data.TaggedError(
  "MissingChannelError",
)<{
  readonly message: string;
}> {
  constructor() {
    super({ message: "You must use this command within a channel." });
  }
}

export class MissingGuildError extends Data.TaggedError("MissingGuildError")<{
  readonly message: string;
}> {
  constructor() {
    super({ message: "You must use this command within a guild." });
  }
}

export class ArgumentError extends Data.TaggedError("ArgumentError")<{
  readonly name: string;
  readonly required: boolean;
  readonly message: string;
}> {
  constructor(name: string, required?: boolean) {
    super({
      name,
      required: required ?? false,
      message: `Invalid argument: ${name}, required: ${required ?? false}`,
    });
  }
}

type RequiredEffect<
  Required extends boolean,
  A,
  EOptional,
  ERequired,
  R,
> = Effect.Effect<
  [Required] extends [true] ? NonNullable<A> : Option.Option<NonNullable<A>>,
  EOptional | ([Required] extends [true] ? ERequired : never),
  R
>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type InferEffect<Ef extends Effect.Effect<any, any, any>> =
  Ef extends Effect.Effect<infer A, infer E, infer R>
    ? Effect.Effect<A, E, R>
    : never;

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

export interface UserSelectMenuInteractionT extends HKT.TypeLambda {
  readonly type: this["Target"] extends CacheType
    ? UserSelectMenuInteraction<this["Target"]>
    : UserSelectMenuInteraction;
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

export interface BaseBaseInteractionT extends HKT.TypeLambda {
  readonly type: BaseInteraction<CacheType>;
}

const mapNullableInteraction =
  <I extends BaseInteraction, A, ERequired, Required extends boolean = false>(
    f: (interaction: I, required: Required) => A,
    requiredError: () => ERequired,
    required?: Required,
  ) =>
  <E, R>(self: Effect.Effect<I, E, R>) =>
    pipe(
      self,
      Effect.map((interaction) =>
        f(interaction, required ?? (false as Required)),
      ),
      Effect.map(Option.fromNullable),
      (e) =>
        (required
          ? pipe(
              e,
              Effect.flatMap(
                Option.match({
                  onSome: Effect.succeed,
                  onNone: () => Effect.fail(requiredError()),
                }),
              ),
            )
          : e) as InferEffect<RequiredEffect<Required, A, E, ERequired, R>>,
    );

const mapTryNullableInteraction =
  <
    I extends BaseInteraction,
    A,
    EOptional,
    ERequired,
    Required extends boolean = false,
  >(
    f: (interaction: I, required: Required) => A,
    optionalError: () => EOptional,
    requiredError: () => ERequired,
    required?: Required,
  ) =>
  <E, R>(self: Effect.Effect<I, E, R>) =>
    pipe(
      self,
      Effect.tryMap({
        try: (interaction) => f(interaction, required ?? (false as Required)),
        catch: () => Effect.fail(optionalError()),
      }),
      Effect.map(Option.fromNullable),
      (e) =>
        (required
          ? pipe(
              e,
              Effect.flatMap(
                Option.match({
                  onSome: Effect.succeed,
                  onNone: () => Effect.fail(requiredError()),
                }),
              ),
            )
          : e) as InferEffect<RequiredEffect<Required, A, E, ERequired, R>>,
    );

export class InteractionContext<I extends BaseBaseInteractionT = InteractionT> {
  $inferInteractionType: Types.Contravariant<I> =
    undefined as unknown as Types.Contravariant<I>;

  static interactionTag = <I extends BaseBaseInteractionT = InteractionT>() =>
    Context.GenericTag<InteractionContext<I>, InteractionKind<I>>(
      "InteractionContext",
    );

  static interaction = <I extends BaseBaseInteractionT = InteractionT>() =>
    wrapOptional(() => InteractionContext.interactionTag<I>());

  static make<I extends BaseBaseInteractionT>(interaction: InteractionKind<I>) {
    return Context.make(this.interactionTag<I>(), interaction);
  }

  static replied = wrapOptional(() =>
    pipe(
      InteractionContext.interaction<RepliableInteractionT>().sync(),
      Effect.flatMap((interaction) => Effect.succeed(interaction.replied)),
    ),
  );

  static deferred = wrapOptional(() =>
    pipe(
      InteractionContext.interaction<RepliableInteractionT>().sync(),
      Effect.flatMap((interaction) => Effect.succeed(interaction.deferred)),
    ),
  );

  static deferReply = wrapOptional((options?: InteractionDeferReplyOptions) =>
    pipe(
      InteractionContext.interaction<RepliableInteractionT>().sync(),
      Effect.flatMap((interaction) =>
        DiscordError.wrapTryPromise(() => interaction.deferReply(options)),
      ),
      Effect.withSpan("InteractionContext.deferReply", {
        captureStackTrace: true,
      }),
    ),
  );

  static deferReplyWithResponse = wrapOptional(
    (options?: InteractionDeferReplyOptions) =>
      pipe(
        InteractionContext.interaction<RepliableInteractionT>().sync(),
        Effect.flatMap((interaction) =>
          DiscordError.wrapTryPromise(() =>
            interaction.deferReply({ ...options, withResponse: true }),
          ),
        ),
        Effect.withSpan("InteractionContext.deferReplyWithResponse", {
          captureStackTrace: true,
        }),
      ),
  );

  static deferUpdate = wrapOptional((options?: InteractionDeferUpdateOptions) =>
    pipe(
      InteractionContext.interaction<MessageComponentInteractionT>().sync(),
      Effect.flatMap((interaction) =>
        DiscordError.wrapTryPromise(() => interaction.deferUpdate(options)),
      ),
      Effect.withSpan("InteractionContext.deferUpdate", {
        captureStackTrace: true,
      }),
    ),
  );

  static deferUpdateWithResponse = wrapOptional(
    (options?: InteractionDeferUpdateOptions) =>
      pipe(
        InteractionContext.interaction<MessageComponentInteractionT>().sync(),
        Effect.flatMap((interaction) =>
          DiscordError.wrapTryPromise(() =>
            interaction.deferUpdate({ ...options, withResponse: true }),
          ),
        ),
        Effect.withSpan("InteractionContext.deferUpdateWithResponse", {
          captureStackTrace: true,
        }),
      ),
  );

  static deleteReply = wrapOptional(
    (message?: MessageResolvable | "@original") =>
      pipe(
        InteractionContext.interaction<RepliableInteractionT>().sync(),
        Effect.flatMap((interaction) =>
          DiscordError.wrapTryPromise(() => interaction.deleteReply(message)),
        ),
        Effect.withSpan("InteractionContext.deleteReply", {
          captureStackTrace: true,
        }),
      ),
  );

  static editReply = wrap(
    (options: string | MessagePayload | InteractionEditReplyOptions) =>
      pipe(
        InteractionContext.interaction<RepliableInteractionT>().sync(),
        Effect.flatMap((interaction) =>
          DiscordError.wrapTryPromise(() => interaction.editReply(options)),
        ),
        Effect.withSpan("InteractionContext.editReply", {
          captureStackTrace: true,
        }),
      ),
  );

  static fetchReply = wrapOptional((message?: Snowflake | "@original") =>
    pipe(
      InteractionContext.interaction<RepliableInteractionT>().sync(),
      Effect.flatMap((interaction) =>
        DiscordError.wrapTryPromise(() => interaction.fetchReply(message)),
      ),
      Effect.withSpan("InteractionContext.fetchReply", {
        captureStackTrace: true,
      }),
    ),
  );

  static followUp = wrap(
    (options: string | MessagePayload | InteractionReplyOptions) =>
      pipe(
        InteractionContext.interaction<RepliableInteractionT>().sync(),
        Effect.flatMap((interaction) =>
          DiscordError.wrapTryPromise(() => interaction.followUp(options)),
        ),
        Effect.withSpan("InteractionContext.followUp", {
          captureStackTrace: true,
        }),
      ),
  );

  static reply = wrap(
    (options: string | MessagePayload | InteractionReplyOptions) =>
      pipe(
        InteractionContext.interaction<RepliableInteractionT>().sync(),
        Effect.flatMap((interaction) =>
          DiscordError.wrapTryPromise(() => interaction.reply(options)),
        ),
        Effect.withSpan("InteractionContext.reply", {
          captureStackTrace: true,
        }),
      ),
  );

  static replyWithResponse = wrap((options: InteractionReplyOptions) =>
    pipe(
      InteractionContext.interaction<RepliableInteractionT>().sync(),
      Effect.flatMap((interaction) =>
        DiscordError.wrapTryPromise(() =>
          interaction.reply({ ...options, withResponse: true }),
        ),
      ),
      Effect.withSpan("InteractionContext.replyWithResponse", {
        captureStackTrace: true,
      }),
    ),
  );

  static update = wrap(
    (options: string | MessagePayload | InteractionUpdateOptions) =>
      pipe(
        InteractionContext.interaction<MessageComponentInteractionT>().sync(),
        Effect.flatMap((interaction) =>
          DiscordError.wrapTryPromise(() => interaction.update(options)),
        ),
        Effect.withSpan("InteractionContext.updateWithResponse", {
          captureStackTrace: true,
        }),
      ),
  );

  static updateWithResponse = wrap((options: InteractionUpdateOptions) =>
    pipe(
      InteractionContext.interaction<MessageComponentInteractionT>().sync(),
      Effect.flatMap((interaction) =>
        DiscordError.wrapTryPromise(() =>
          interaction.update({ ...options, withResponse: true }),
        ),
      ),
      Effect.withSpan("InteractionContext.updateWithResponse", {
        captureStackTrace: true,
      }),
    ),
  );

  static channelId = <Required extends boolean>(required?: Required) =>
    wrapOptional(() =>
      pipe(
        InteractionContext.interaction<InteractionT>().sync(),
        mapNullableInteraction(
          (interaction) => interaction.channelId,
          () => new MissingChannelError(),
          required,
        ),
      ),
    );

  static channel = <Required extends boolean>(required?: Required) =>
    wrapOptional(() =>
      pipe(
        InteractionContext.interaction<InteractionT>().sync(),
        mapNullableInteraction(
          (interaction) => interaction.channel,
          () => new MissingChannelError(),
          required,
        ),
      ),
    );

  static guildId = <Required extends boolean>(required?: Required) =>
    wrapOptional(() =>
      pipe(
        InteractionContext.interaction<InteractionT>().sync(),
        mapNullableInteraction(
          (interaction) => interaction.guildId,
          () => new MissingGuildError(),
          required,
        ),
      ),
    );

  static guild = <Required extends boolean>(required?: Required) =>
    wrapOptional(() =>
      pipe(
        InteractionContext.interaction<InteractionT>().sync(),
        mapNullableInteraction(
          (interaction) => interaction.guild,
          () => new MissingGuildError(),
          required,
        ),
      ),
    );

  static user = wrapOptional(() =>
    pipe(
      InteractionContext.interaction<InteractionT>().sync(),
      Effect.flatMap((interaction) => Effect.succeed(interaction.user)),
    ),
  );

  static getSubcommandGroup<Required extends boolean>(required?: Required) {
    return pipe(
      InteractionContext.interaction<ChatInputCommandInteractionT>().sync(),
      mapTryNullableInteraction(
        (interaction, required) =>
          interaction.options.getSubcommandGroup(required),
        () => new ArgumentError("subcommandGroup", required),
        () => new ArgumentError("subcommandGroup", required),
        required,
      ),
    );
  }

  static getSubcommand<Required extends boolean>(required?: Required) {
    return pipe(
      InteractionContext.interaction<ChatInputCommandInteractionT>().sync(),
      mapTryNullableInteraction(
        (interaction, required) => interaction.options.getSubcommand(required),
        () => new ArgumentError("subcommand", required),
        () => new ArgumentError("subcommand", required),
        required,
      ),
    );
  }

  static getBoolean<Required extends boolean>(
    name: string,
    required?: Required,
  ) {
    return pipe(
      InteractionContext.interaction<ChatInputCommandInteractionT>().sync(),
      mapTryNullableInteraction(
        (interaction, required) =>
          interaction.options.getBoolean(name, required),
        () => new ArgumentError(name, required),
        () => new ArgumentError(name, required),
        required,
      ),
    );
  }

  static getChannel<
    Required extends boolean,
    const Type extends ChannelType = ChannelType,
  >(name: string, required?: Required, channelTypes?: readonly Type[]) {
    return pipe(
      InteractionContext.interaction<ChatInputCommandInteractionT>().sync(),
      mapTryNullableInteraction(
        (interaction, required) =>
          interaction.options.getChannel(name, required, channelTypes),
        () => new ArgumentError(name, required),
        () => new ArgumentError(name, required),
        required,
      ),
    );
  }

  static getString<Required extends boolean>(
    name: string,
    required?: Required,
  ) {
    return pipe(
      InteractionContext.interaction<ChatInputCommandInteractionT>().sync(),
      mapTryNullableInteraction(
        (interaction, required) =>
          interaction.options.getString(name, required),
        () => new ArgumentError(name, required),
        () => new ArgumentError(name, required),
        required,
      ),
    );
  }

  static getInteger<Required extends boolean>(
    name: string,
    required?: Required,
  ) {
    return pipe(
      InteractionContext.interaction<ChatInputCommandInteractionT>().sync(),
      mapTryNullableInteraction(
        (interaction, required) =>
          interaction.options.getInteger(name, required),
        () => new ArgumentError(name, required),
        () => new ArgumentError(name, required),
        required,
      ),
    );
  }

  static getNumber<Required extends boolean>(
    name: string,
    required?: Required,
  ) {
    return pipe(
      InteractionContext.interaction<ChatInputCommandInteractionT>().sync(),
      mapTryNullableInteraction(
        (interaction, required) =>
          interaction.options.getNumber(name, required),
        () => new ArgumentError(name, required),
        () => new ArgumentError(name, required),
        required,
      ),
    );
  }

  static getUser<Required extends boolean>(name: string, required?: Required) {
    return pipe(
      InteractionContext.interaction<ChatInputCommandInteractionT>().sync(),
      mapTryNullableInteraction(
        (interaction, required) => interaction.options.getUser(name, required),
        () => new ArgumentError(name, required),
        () => new ArgumentError(name, required),
        required,
      ),
    );
  }

  static getMember<Required extends boolean>(
    name: string,
    required?: Required,
  ) {
    return pipe(
      InteractionContext.interaction<ChatInputCommandInteractionT>().sync(),
      mapTryNullableInteraction(
        (interaction) => interaction.options.getMember(name),
        () => new ArgumentError(name, required),
        () => new ArgumentError(name, required),
        required,
      ),
    );
  }

  static getRole<Required extends boolean>(name: string, required?: Required) {
    return pipe(
      InteractionContext.interaction<ChatInputCommandInteractionT>().sync(),
      mapTryNullableInteraction(
        (interaction) => interaction.options.getRole(name, required),
        () => new ArgumentError(name, required),
        () => new ArgumentError(name, required),
        required,
      ),
    );
  }

  static getAttachment<Required extends boolean>(
    name: string,
    required?: Required,
  ) {
    return pipe(
      InteractionContext.interaction<ChatInputCommandInteractionT>().sync(),
      mapTryNullableInteraction(
        (interaction) => interaction.options.getAttachment(name, required),
        () => new ArgumentError(name, required),
        () => new ArgumentError(name, required),
        required,
      ),
    );
  }

  static getMentionable<Required extends boolean>(
    name: string,
    required?: Required,
  ) {
    return pipe(
      InteractionContext.interaction<ChatInputCommandInteractionT>().sync(),
      mapTryNullableInteraction(
        (interaction, required) =>
          interaction.options.getMentionable(name, required),
        () => new ArgumentError(name, required),
        () => new ArgumentError(name, required),
        required,
      ),
    );
  }
}

interface BaseMessageInteractionT extends HKT.TypeLambda {
  readonly type:
    | MessageComponentInteraction<CacheType>
    | ModalSubmitInteraction<CacheType>;
}

export class CachedInteractionContext {
  static interaction = <
    I extends BaseBaseInteractionT = InteractionT,
    Kind extends InteractionKind<I, "cached"> = InteractionKind<I, "cached">,
  >() =>
    wrapOptional(() =>
      pipe(
        InteractionContext.interaction<I>().sync(),
        Effect.tap((interaction) =>
          pipe(
            Effect.fail(new NotInGuildError()),
            Effect.unless(() => interaction.inGuild()),
          ),
        ),
        Effect.tap((interaction) =>
          pipe(
            Effect.fail(new UncachedGuildError()),
            Effect.unless(() => interaction.inCachedGuild()),
          ),
        ),
        Effect.map((interaction) => interaction as Kind),
      ),
    );

  static message = <
    I extends BaseMessageInteractionT,
    Kind extends InteractionKind<I, "cached"> = InteractionKind<I, "cached">,
  >() =>
    wrapOptional(() =>
      pipe(
        CachedInteractionContext.interaction<I, Kind>().sync(),
        Effect.flatMap((interaction) =>
          Effect.succeed(interaction.message as Kind["message"]),
        ),
      ),
    );

  static channel = <Required extends boolean>(required?: Required) =>
    wrapOptional(() =>
      pipe(
        CachedInteractionContext.interaction<InteractionT>().sync(),
        mapNullableInteraction(
          (interaction) => interaction.channel,
          () => new MissingChannelError(),
          required,
        ),
      ),
    );

  static guildId = () =>
    wrapOptional(() =>
      pipe(
        CachedInteractionContext.interaction<InteractionT>().sync(),
        Effect.flatMap((interaction) => Effect.succeed(interaction.guildId)),
      ),
    );

  static guild = () =>
    wrapOptional(() =>
      pipe(
        CachedInteractionContext.interaction<InteractionT>().sync(),
        Effect.flatMap((interaction) => Effect.succeed(interaction.guild)),
      ),
    );

  static getChannel<
    Required extends boolean,
    const Type extends ChannelType = ChannelType,
  >(name: string, required?: Required, channelTypes?: readonly Type[]) {
    return pipe(
      CachedInteractionContext.interaction<ChatInputCommandInteractionT>().sync(),
      mapTryNullableInteraction(
        (interaction) =>
          interaction.options.getChannel(name, required, channelTypes),
        () => new ArgumentError(name, required),
        () => new ArgumentError(name, required),
        required,
      ),
    );
  }

  static getMember<Required extends boolean>(
    name: string,
    required?: Required,
  ) {
    return pipe(
      CachedInteractionContext.interaction<ChatInputCommandInteractionT>().sync(),
      mapTryNullableInteraction(
        (interaction) => interaction.options.getMember(name),
        () => new ArgumentError(name, required),
        () => new ArgumentError(name, required),
        required,
      ),
    );
  }

  static getRole<Required extends boolean>(name: string, required?: Required) {
    return pipe(
      CachedInteractionContext.interaction<ChatInputCommandInteractionT>().sync(),
      mapTryNullableInteraction(
        (interaction) => interaction.options.getRole(name, required),
        () => new ArgumentError(name, required),
        () => new ArgumentError(name, required),
        required,
      ),
    );
  }

  static getMentionable<Required extends boolean>(
    name: string,
    required?: Required,
  ) {
    return pipe(
      CachedInteractionContext.interaction<ChatInputCommandInteractionT>().sync(),
      mapTryNullableInteraction(
        (interaction) => interaction.options.getMentionable(name, required),
        () => new ArgumentError(name, required),
        () => new ArgumentError(name, required),
        required,
      ),
    );
  }
}
