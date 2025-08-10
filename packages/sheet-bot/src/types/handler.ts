import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  InteractionButtonComponentData,
  SharedSlashCommand,
  SharedSlashCommandSubcommands,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
  SlashCommandSubcommandGroupBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";
import { Data, Effect, HashMap, Option, pipe } from "effect";
import { InteractionContext } from "./interactionContext";
type Constrain<T, C> = T extends infer U extends C ? U : never;

export type InteractionHandler<E = never, R = never> = Effect.Effect<
  unknown,
  E,
  R
>;
export type AnyInteractionHandler<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  E = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  R = any,
> = InteractionHandler<E, R>;

type InteractionHandlerError<H extends AnyInteractionHandler> =
  H extends InteractionHandler<infer E, unknown> ? E : never;

type InteractionHandlerRequirement<H extends AnyInteractionHandler> =
  H extends InteractionHandler<unknown, infer R> ? R : never;

export type InferInteractionHandler<Handler extends AnyInteractionHandler> =
  InteractionHandler<
    InteractionHandlerError<Handler>,
    InteractionHandlerRequirement<Handler>
  >;

export type ButtonInteractionHandler<E = never, R = never> = InteractionHandler<
  E,
  R | InteractionContext<ButtonInteraction>
>;
export type AnyButtonInteractionHandler<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  E = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  R = any,
> = ButtonInteractionHandler<E, R>;

export type ChatInputCommandHandler<E = never, R = never> = InteractionHandler<
  E,
  R | InteractionContext<ChatInputCommandInteraction>
>;
export type AnyChatInputCommandHandler<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  E = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  R = any,
> = ChatInputCommandHandler<E, R>;

export type ChatInputSubcommandGroupHandler<
  E = never,
  R = never,
> = InteractionHandler<E, R | InteractionContext<ChatInputCommandInteraction>>;
export type AnyChatInputSubcommandGroupHandler<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  E = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  R = any,
> = ChatInputSubcommandGroupHandler<E, R>;

export type ChatInputSubcommandHandler<
  E = never,
  R = never,
> = InteractionHandler<E, R | InteractionContext<ChatInputCommandInteraction>>;
export type AnyChatInputSubcommandHandler<
  E = unknown,
  R = unknown,
> = ChatInputSubcommandHandler<E, R>;

export type InteractionHandlerContextObject<
  Data = unknown,
  E = never,
  R = never,
> = {
  data: Data;
  handler: InteractionHandler<E, R>;
};

export class InteractionHandlerContext<
  Data = unknown,
  E = never,
  R = never,
> extends Data.TaggedClass("InteractionHandlerContext")<
  InteractionHandlerContextObject<Data, E, R>
> {}

export type ButtonInteractionHandlerContext<
  E = never,
  R = never,
> = InteractionHandlerContext<
  InteractionButtonComponentData,
  E,
  R | InteractionContext<ButtonInteraction>
>;

export type ChatInputCommandHandlerContext<
  E = never,
  R = never,
> = InteractionHandlerContext<
  SharedSlashCommand | SlashCommandSubcommandsOnlyBuilder,
  E,
  R | InteractionContext<ChatInputCommandInteraction>
>;

export type ChatInputSubcommandGroupHandlerContext<
  E = never,
  R = never,
> = InteractionHandlerContext<
  SlashCommandSubcommandGroupBuilder,
  E,
  R | InteractionContext<ChatInputCommandInteraction>
>;

export type ChatInputSubcommandHandlerContext<
  E = never,
  R = never,
> = InteractionHandlerContext<
  SlashCommandSubcommandBuilder,
  E,
  R | InteractionContext<ChatInputCommandInteraction>
>;

export type InteractionHandlerContextBuilderObject<
  Data extends Option.Option<unknown> = Option.None<unknown>,
  Handler extends
    Option.Option<AnyInteractionHandler> = Option.None<AnyInteractionHandler>,
> = {
  _data: Data;
  _handler: Handler;
};

export class InteractionHandlerContextBuilder<
  Data extends Option.Option<unknown> = Option.None<unknown>,
  Handler extends
    Option.Option<AnyInteractionHandler> = Option.None<AnyInteractionHandler>,
> extends Data.TaggedClass("InteractionHandlerContextBuilder")<
  InteractionHandlerContextBuilderObject<Data, Handler>
> {
  static empty<
    Data = unknown,
    Handler extends AnyInteractionHandler = AnyInteractionHandler,
  >() {
    return new InteractionHandlerContextBuilder({
      _data: Option.none() as Option.None<Data>,
      _handler: Option.none() as Option.None<Handler>,
    });
  }

  data<BuilderData extends Option.Option.Value<Data>>(
    this: InteractionHandlerContextBuilder<
      Option.None<Option.Option.Value<Data>>,
      Handler
    >,
    data: BuilderData,
  ) {
    return new InteractionHandlerContextBuilder({
      _data: Option.some(data) as Option.Some<Option.Option.Value<Data>>,
      _handler: this._handler,
    });
  }

  handler<
    BuilderHandler extends Constrain<
      Option.Option.Value<Handler>,
      AnyInteractionHandler
    >,
  >(
    this: InteractionHandlerContextBuilder<
      Data,
      Option.None<
        Constrain<Option.Option.Value<Handler>, AnyInteractionHandler>
      >
    >,
    handler: BuilderHandler,
  ) {
    return new InteractionHandlerContextBuilder({
      _data: this._data,
      _handler: Option.some(handler) as Option.Some<BuilderHandler>,
    });
  }

  build<
    InnerData extends Option.Option.Value<Data> = Option.Option.Value<Data>,
    InnerHandler extends Constrain<
      Option.Option.Value<Handler>,
      AnyInteractionHandler
    > = Constrain<Option.Option.Value<Handler>, AnyInteractionHandler>,
  >(
    this: InteractionHandlerContextBuilder<
      Option.Some<InnerData>,
      Option.Some<InnerHandler>
    >,
  ) {
    return new InteractionHandlerContext({
      data: this._data.value,
      handler: this._handler.value as InferInteractionHandler<InnerHandler>,
    });
  }
}

export const buttonInteractionHandlerContextBuilder = () =>
  InteractionHandlerContextBuilder.empty<
    InteractionButtonComponentData,
    AnyButtonInteractionHandler
  >();

export const chatInputCommandHandlerContextBuilder = () =>
  InteractionHandlerContextBuilder.empty<
    SharedSlashCommand,
    AnyChatInputCommandHandler
  >();

export const chatInputSubcommandGroupHandlerContextBuilder = () =>
  InteractionHandlerContextBuilder.empty<
    SlashCommandSubcommandGroupBuilder,
    AnyChatInputSubcommandGroupHandler
  >();

export const chatInputSubcommandHandlerContextBuilder = () =>
  InteractionHandlerContextBuilder.empty<
    SlashCommandSubcommandBuilder,
    AnyChatInputSubcommandHandler
  >();

export type InteractionHandlerMapObject<
  Data = unknown,
  E = never,
  R = never,
> = {
  map: HashMap.HashMap<string, InteractionHandlerContext<Data, E, R>>;
  keyGetter: (data: Data) => string;
};

export class InteractionHandlerMap<
  Data = unknown,
  E = never,
  R = never,
> extends Data.TaggedClass("InteractionHandlerMap")<
  InteractionHandlerMapObject<Data, E, R>
> {
  static empty<Data = unknown, E = never, R = never>(
    keyGetter: (data: Data) => string,
  ) {
    return new InteractionHandlerMap<Data, E, R>({
      map: HashMap.empty(),
      keyGetter,
    });
  }

  static add<Data1 extends Data2, Data2, E1 = never, R1 = never>(
    context: InteractionHandlerContext<Data1, E1, R1>,
  ) {
    return <E2 = never, R2 = never>(
      map: InteractionHandlerMap<Data2, E2, R2>,
    ) =>
      new InteractionHandlerMap({
        map: HashMap.set(
          map.map as HashMap.HashMap<
            string,
            InteractionHandlerContext<Data2, E1 | E2, R1 | R2>
          >,
          map.keyGetter(context.data),
          context,
        ),
        keyGetter: map.keyGetter,
      });
  }

  static get(key: string) {
    return <Data, E, R>(map: InteractionHandlerMap<Data, E, R>) =>
      HashMap.get(map.map, key);
  }

  static union<Data1 extends Data2, Data2, E1 = never, R1 = never>(
    map: InteractionHandlerMap<Data1, E1, R1>,
  ) {
    return <E2 = never, R2 = never>(
      other: InteractionHandlerMap<Data2, E2, R2>,
    ) =>
      new InteractionHandlerMap({
        map: HashMap.union(
          map.map as HashMap.HashMap<
            string,
            InteractionHandlerContext<Data2, E1 | E2, R1 | R2>
          >,
          other.map as HashMap.HashMap<
            string,
            InteractionHandlerContext<Data2, E1 | E2, R1 | R2>
          >,
        ),
        keyGetter: other.keyGetter,
      });
  }

  static values<Data, E, R>(map: InteractionHandlerMap<Data, E, R>) {
    return HashMap.values(map.map);
  }
}

export type ButtonInteractionHandlerMap<
  E = never,
  R = never,
> = InteractionHandlerMap<
  InteractionButtonComponentData,
  E,
  R | InteractionContext<ButtonInteraction>
>;

export type ChatInputCommandHandlerMap<
  E = never,
  R = never,
> = InteractionHandlerMap<
  SharedSlashCommand | SlashCommandSubcommandsOnlyBuilder,
  E,
  R | InteractionContext<ChatInputCommandInteraction>
>;

export type ChatInputSubcommandGroupHandlerMap<
  E = never,
  R = never,
> = InteractionHandlerMap<
  SlashCommandSubcommandGroupBuilder,
  E,
  R | InteractionContext<ChatInputCommandInteraction>
>;

export type ChatInputSubcommandHandlerMap<
  E = never,
  R = never,
> = InteractionHandlerMap<
  SlashCommandSubcommandBuilder,
  E,
  R | InteractionContext<ChatInputCommandInteraction>
>;

export const buttonInteractionHandlerMap = <E = never, R = never>() =>
  InteractionHandlerMap.empty<InteractionButtonComponentData, E, R>(
    (data) => data.customId,
  );

export const chatInputCommandHandlerMap = <E = never, R = never>() =>
  InteractionHandlerMap.empty<
    SharedSlashCommand | SlashCommandSubcommandsOnlyBuilder,
    E,
    R
  >((data) => data.name);

export const chatInputSubcommandGroupHandlerMap = <E = never, R = never>() =>
  InteractionHandlerMap.empty<SlashCommandSubcommandGroupBuilder, E, R>(
    (data) => data.name,
  );

export const chatInputSubcommandHandlerMap = <E = never, R = never>() =>
  InteractionHandlerMap.empty<SlashCommandSubcommandBuilder, E, R>(
    (data) => data.name,
  );

export type SubcommandHandlerObject<E = never, R = never> = {
  subcommandGroupHandlerMap: ChatInputSubcommandGroupHandlerMap<E, R>;
  subcommandHandlerMap: ChatInputSubcommandHandlerMap<E, R>;
};

export class SubcommandHandler<
  out E = never,
  out R = never,
> extends Data.TaggedClass("SubcommandHandler")<SubcommandHandlerObject<E, R>> {
  static empty<E = never, R = never>() {
    return new SubcommandHandler({
      subcommandGroupHandlerMap: chatInputSubcommandGroupHandlerMap<E, R>(),
      subcommandHandlerMap: chatInputSubcommandHandlerMap<E, R>(),
    });
  }

  static addSubcommandGroupHandler<E = never, R = never>(
    handler: ChatInputSubcommandGroupHandlerContext<E, R>,
  ) {
    return <ME = never, MR = never>(map: SubcommandHandler<ME, MR>) =>
      new SubcommandHandler({
        subcommandGroupHandlerMap: pipe(
          map.subcommandGroupHandlerMap,
          InteractionHandlerMap.add(handler),
        ),
        subcommandHandlerMap: map.subcommandHandlerMap,
      });
  }

  static addSubcommandGroupHandlerMap<E = never, R = never>(
    handlerMap: ChatInputSubcommandGroupHandlerMap<E, R>,
  ) {
    return <ME = never, MR = never>(map: SubcommandHandler<ME, MR>) =>
      new SubcommandHandler({
        subcommandGroupHandlerMap: pipe(
          map.subcommandGroupHandlerMap,
          InteractionHandlerMap.union(handlerMap),
        ),
        subcommandHandlerMap: map.subcommandHandlerMap,
      });
  }

  static addSubcommandHandler<E = never, R = never>(
    handler: ChatInputSubcommandHandlerContext<E, R>,
  ) {
    return <ME = never, MR = never>(map: SubcommandHandler<ME, MR>) =>
      new SubcommandHandler({
        subcommandGroupHandlerMap: map.subcommandGroupHandlerMap,
        subcommandHandlerMap: pipe(
          map.subcommandHandlerMap,
          InteractionHandlerMap.add(handler),
        ),
      });
  }

  static addSubcommandHandlerMap<E = never, R = never>(
    handlerMap: InteractionHandlerMap<SlashCommandSubcommandBuilder, E, R>,
  ) {
    return <ME = never, MR = never>(map: SubcommandHandler<ME, MR>) =>
      new SubcommandHandler({
        subcommandGroupHandlerMap: map.subcommandGroupHandlerMap,
        subcommandHandlerMap: pipe(
          map.subcommandHandlerMap,
          InteractionHandlerMap.union(handlerMap),
        ),
      });
  }

  static handler<E = never, R = never>(handler: SubcommandHandler<E, R>) {
    return pipe(
      InteractionContext.interaction<ChatInputCommandInteraction>(),
      Effect.flatMap((interaction) =>
        pipe(
          Option.fromNullable(interaction.options.getSubcommandGroup()),
          Option.flatMap((group) =>
            InteractionHandlerMap.get(group)(handler.subcommandGroupHandlerMap),
          ),
          Option.map((ctx) => ctx.handler),
          Option.orElse(() =>
            pipe(
              Option.fromNullable(interaction.options.getSubcommand()),
              Option.flatMap((subcommand) =>
                InteractionHandlerMap.get(subcommand)(
                  handler.subcommandHandlerMap,
                ),
              ),
              Option.map((ctx) => ctx.handler),
            ),
          ),
          Option.getOrElse<InteractionHandler<never, never>>(() =>
            Effect.succeed(undefined),
          ),
        ),
      ),
    );
  }
}

type InteractionHandlerContextWithSubcommandHandlerBuilderData<
  Data extends Option.Option<
    | (SharedSlashCommandSubcommands<SlashCommandSubcommandsOnlyBuilder> &
        SharedSlashCommand)
    | SlashCommandSubcommandGroupBuilder
  > = Option.None<
    | (SharedSlashCommandSubcommands<SlashCommandSubcommandsOnlyBuilder> &
        SharedSlashCommand)
    | SlashCommandSubcommandGroupBuilder
  >,
  E = never,
  R = never,
> = {
  _data: Data;
  _handler: SubcommandHandler<E, R>;
};

export class InteractionHandlerContextWithSubcommandHandlerBuilder<
  Data extends Option.Option<
    | SlashCommandBuilder
    | SlashCommandSubcommandsOnlyBuilder
    | SlashCommandSubcommandGroupBuilder
  > = Option.None<
    | SlashCommandBuilder
    | SlashCommandSubcommandsOnlyBuilder
    | SlashCommandSubcommandGroupBuilder
  >,
  E = never,
  R = never,
> extends Data.TaggedClass(
  "InteractionHandlerContextWithSubcommandHandlerBuilder",
)<InteractionHandlerContextWithSubcommandHandlerBuilderData<Data, E, R>> {
  static empty<
    BuilderData extends
      | SlashCommandBuilder
      | SlashCommandSubcommandsOnlyBuilder
      | SlashCommandSubcommandGroupBuilder,
    E = never,
    R = never,
  >() {
    return new InteractionHandlerContextWithSubcommandHandlerBuilder({
      _data: Option.none() as Option.None<BuilderData>,
      _handler: SubcommandHandler.empty<E, R>(),
    });
  }

  data<
    BuilderData extends
      | SlashCommandBuilder
      | SlashCommandSubcommandsOnlyBuilder
      | SlashCommandSubcommandGroupBuilder,
    E,
    R,
  >(
    this: InteractionHandlerContextWithSubcommandHandlerBuilder<
      Option.None<
        | SlashCommandBuilder
        | SlashCommandSubcommandsOnlyBuilder
        | SlashCommandSubcommandGroupBuilder
      >,
      E,
      R
    >,
    data: BuilderData,
  ) {
    return new InteractionHandlerContextWithSubcommandHandlerBuilder({
      _data: Option.some(data) as Option.Some<BuilderData>,
      _handler: this._handler,
    });
  }

  addSubcommandHandler<
    BuilderData extends
      | SlashCommandBuilder
      | SlashCommandSubcommandsOnlyBuilder
      | SlashCommandSubcommandGroupBuilder,
    E,
    R,
    ME,
    MR,
  >(
    this: InteractionHandlerContextWithSubcommandHandlerBuilder<
      Option.Some<BuilderData>,
      ME,
      MR
    >,
    handler: ChatInputSubcommandHandlerContext<E, R>,
  ) {
    return new InteractionHandlerContextWithSubcommandHandlerBuilder({
      _data: Option.some(
        this._data.value.addSubcommand(handler.data),
      ) as Option.Some<
        BuilderData extends SlashCommandSubcommandGroupBuilder
          ? SlashCommandSubcommandGroupBuilder
          : SlashCommandSubcommandsOnlyBuilder
      >,
      _handler: pipe(
        this._handler,
        SubcommandHandler.addSubcommandHandler(handler),
      ),
    });
  }

  addSubcommandGroupHandler<
    BuilderData extends
      | SlashCommandBuilder
      | SlashCommandSubcommandsOnlyBuilder,
    E,
    R,
    ME,
    MR,
  >(
    this: InteractionHandlerContextWithSubcommandHandlerBuilder<
      Option.Some<BuilderData>,
      ME,
      MR
    >,
    handler: ChatInputSubcommandGroupHandlerContext<E, R>,
  ) {
    return new InteractionHandlerContextWithSubcommandHandlerBuilder({
      _data: Option.some(
        this._data.value.addSubcommandGroup(handler.data),
      ) as Option.Some<SlashCommandSubcommandsOnlyBuilder>,
      _handler: pipe(
        this._handler,
        SubcommandHandler.addSubcommandGroupHandler(handler),
      ),
    });
  }

  toContext<
    BuilderData extends
      | SlashCommandBuilder
      | SlashCommandSubcommandsOnlyBuilder
      | SlashCommandSubcommandGroupBuilder,
  >(
    this: InteractionHandlerContextWithSubcommandHandlerBuilder<
      Option.Some<BuilderData>,
      E,
      R
    >,
  ) {
    return new InteractionHandlerContext({
      data: this._data.value,
      handler: SubcommandHandler.handler(this._handler),
    });
  }
}

export class ChatInputCommandHandlerContextWithSubcommandHandlerBuilder<
  Data extends Option.Option<
    SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder
  > = Option.None<SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder>,
  E = never,
  R = never,
> extends Data.TaggedClass(
  "ChatInputCommandHandlerContextWithSubcommandHandlerBuilder",
)<{
  builder: InteractionHandlerContextWithSubcommandHandlerBuilder<Data, E, R>;
}> {
  static empty() {
    return new ChatInputCommandHandlerContextWithSubcommandHandlerBuilder({
      builder: InteractionHandlerContextWithSubcommandHandlerBuilder.empty<
        SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder
      >(),
    });
  }

  data<
    BuilderData extends
      | SlashCommandBuilder
      | SlashCommandSubcommandsOnlyBuilder,
    E,
    R,
  >(
    this: ChatInputCommandHandlerContextWithSubcommandHandlerBuilder<
      Option.None<SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder>,
      E,
      R
    >,
    data: BuilderData,
  ) {
    return new ChatInputCommandHandlerContextWithSubcommandHandlerBuilder({
      builder: this.builder.data(data),
    });
  }

  addSubcommandHandler<
    BuilderData extends
      | SlashCommandBuilder
      | SlashCommandSubcommandsOnlyBuilder,
    E,
    R,
    ME,
    MR,
  >(
    this: ChatInputCommandHandlerContextWithSubcommandHandlerBuilder<
      Option.Some<BuilderData>,
      ME,
      MR
    >,
    handler: ChatInputSubcommandHandlerContext<E, R>,
  ) {
    return new ChatInputCommandHandlerContextWithSubcommandHandlerBuilder({
      builder: this.builder.addSubcommandHandler(handler),
    });
  }

  addSubcommandGroupHandler<
    BuilderData extends
      | SlashCommandBuilder
      | SlashCommandSubcommandsOnlyBuilder,
    E,
    R,
    ME,
    MR,
  >(
    this: ChatInputCommandHandlerContextWithSubcommandHandlerBuilder<
      Option.Some<BuilderData>,
      ME,
      MR
    >,
    handler: ChatInputSubcommandGroupHandlerContext<E, R>,
  ) {
    return new ChatInputCommandHandlerContextWithSubcommandHandlerBuilder({
      builder: this.builder.addSubcommandGroupHandler(handler),
    });
  }

  build<
    BuilderData extends
      | SlashCommandBuilder
      | SlashCommandSubcommandsOnlyBuilder,
    E,
    R,
  >(
    this: ChatInputCommandHandlerContextWithSubcommandHandlerBuilder<
      Option.Some<BuilderData>,
      E,
      R
    >,
  ) {
    return this.builder.toContext();
  }
}

export class ChatInputSubcommandGroupHandlerContextWithSubcommandHandlerBuilder<
  Data extends
    Option.Option<SlashCommandSubcommandGroupBuilder> = Option.None<SlashCommandSubcommandGroupBuilder>,
  E = never,
  R = never,
> extends Data.TaggedClass(
  "ChatInputSubcommandGroupHandlerContextWithSubcommandHandlerBuilder",
)<{
  builder: InteractionHandlerContextWithSubcommandHandlerBuilder<Data, E, R>;
}> {
  static empty() {
    return new ChatInputSubcommandGroupHandlerContextWithSubcommandHandlerBuilder(
      {
        builder:
          InteractionHandlerContextWithSubcommandHandlerBuilder.empty<SlashCommandSubcommandGroupBuilder>(),
      },
    );
  }

  data<BuilderData extends SlashCommandSubcommandGroupBuilder, E, R>(
    this: ChatInputSubcommandGroupHandlerContextWithSubcommandHandlerBuilder<
      Option.None<SlashCommandSubcommandGroupBuilder>,
      E,
      R
    >,
    data: BuilderData,
  ) {
    return new ChatInputSubcommandGroupHandlerContextWithSubcommandHandlerBuilder(
      {
        builder: this.builder.data(data),
      },
    );
  }

  addSubcommandHandler<
    BuilderData extends SlashCommandSubcommandGroupBuilder,
    E,
    R,
    ME,
    MR,
  >(
    this: ChatInputSubcommandGroupHandlerContextWithSubcommandHandlerBuilder<
      Option.Some<BuilderData>,
      ME,
      MR
    >,
    handler: ChatInputSubcommandHandlerContext<E, R>,
  ) {
    return new ChatInputSubcommandGroupHandlerContextWithSubcommandHandlerBuilder(
      {
        builder: this.builder.addSubcommandHandler(handler),
      },
    );
  }

  build<BuilderData extends SlashCommandSubcommandGroupBuilder, E, R>(
    this: ChatInputSubcommandGroupHandlerContextWithSubcommandHandlerBuilder<
      Option.Some<BuilderData>,
      E,
      R
    >,
  ) {
    return this.builder.toContext();
  }
}

export const chatInputCommandHandlerContextWithSubcommandHandlerBuilder = () =>
  ChatInputCommandHandlerContextWithSubcommandHandlerBuilder.empty();

export const chatInputSubcommandGroupHandlerContextWithSubcommandHandlerBuilder =
  () =>
    ChatInputSubcommandGroupHandlerContextWithSubcommandHandlerBuilder.empty();
