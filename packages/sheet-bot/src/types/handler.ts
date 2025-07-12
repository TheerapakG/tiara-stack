import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  Interaction,
  InteractionButtonComponentData,
  SharedSlashCommand,
  SlashCommandSubcommandBuilder,
  SlashCommandSubcommandGroupBuilder,
} from "discord.js";
import { Data, Effect, HashMap, Option, pipe } from "effect";

export type InteractionHandler<
  in I extends Interaction = Interaction,
  out E = never,
  out R = never,
> = (interaction: I) => Effect.Effect<unknown, E, R>;

export type AnyInteractionHandler<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  I extends Interaction = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  E = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  R = any,
> = InteractionHandler<I, E, R>;

export type InteractionHandlerContextData<
  Data = unknown,
  Handler extends AnyInteractionHandler = AnyInteractionHandler,
> = {
  data: Data;
  handler: Handler;
};

export class InteractionHandlerContext<
  Data = unknown,
  Handler extends AnyInteractionHandler = AnyInteractionHandler,
> extends Data.TaggedClass("InteractionHandlerContext")<
  InteractionHandlerContextData<Data, Handler>
> {
  static fromBuilderContext<
    Context extends InteractionHandlerContextBuilderData<
      Option.Some<unknown>,
      Option.Some<AnyInteractionHandler>
    >,
    Data extends Context extends InteractionHandlerContextBuilderData<
      Option.Some<infer D>,
      Option.Some<AnyInteractionHandler>
    >
      ? D
      : never,
    Handler extends Context extends InteractionHandlerContextBuilderData<
      Option.Some<unknown>,
      Option.Some<infer H extends AnyInteractionHandler>
    >
      ? H
      : never,
  >(context: Context) {
    return new InteractionHandlerContext({
      data: context._data.value as Data,
      handler: context._handler.value as Handler,
    });
  }
}

type InteractionHandlerContextBuilderData<
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
  InteractionHandlerContextBuilderData<Data, Handler>
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

  data<BuilderData>(
    this: InteractionHandlerContextBuilder<Option.None<unknown>, Handler>,
    data: BuilderData,
  ) {
    return new InteractionHandlerContextBuilder({
      _data: Option.some(data) as Option.Some<BuilderData>,
      _handler: this._handler,
    });
  }

  handler<BuilderHandler extends AnyInteractionHandler>(
    this: InteractionHandlerContextBuilder<
      Data,
      Option.None<AnyInteractionHandler>
    >,
    handler: BuilderHandler,
  ) {
    return new InteractionHandlerContextBuilder({
      _data: this._data,
      _handler: Option.some(
        handler as unknown as BuilderHandler,
      ) as Option.Some<BuilderHandler>,
    });
  }
}

export class ButtonInteractionHandlerContext<
  E = unknown,
  R = unknown,
> extends Data.TaggedClass("ButtonInteractionHandlerContext")<
  InteractionHandlerContextData<
    InteractionButtonComponentData,
    AnyInteractionHandler<ButtonInteraction, E, R>
  >
> {
  static make<
    Data extends
      InteractionButtonComponentData = InteractionButtonComponentData,
    Handler extends
      AnyInteractionHandler<ButtonInteraction> = AnyInteractionHandler<ButtonInteraction>,
    E = Effect.Effect.Error<ReturnType<Handler>>,
    R = Effect.Effect.Context<ReturnType<Handler>>,
  >(context: InteractionHandlerContextData<Data, Handler>) {
    return new ButtonInteractionHandlerContext<E, R>(context);
  }

  static fromBuilderContext<
    Context extends InteractionHandlerContextBuilderData<
      Option.Some<InteractionButtonComponentData>,
      Option.Some<AnyInteractionHandler<ButtonInteraction>>
    >,
  >(context: Context) {
    return ButtonInteractionHandlerContext.make(
      InteractionHandlerContext.fromBuilderContext(context),
    );
  }
}

export class ButtonInteractionHandlerContextBuilder<
  Data extends
    Option.Option<InteractionButtonComponentData> = Option.None<InteractionButtonComponentData>,
  Handler extends Option.Option<
    AnyInteractionHandler<ButtonInteraction>
  > = Option.None<AnyInteractionHandler<ButtonInteraction>>,
  InnerData extends Option.Option.Value<Data> extends infer D
    ? D extends InteractionButtonComponentData
      ? D
      : never
    : never = Option.Option.Value<Data> extends infer D
    ? D extends InteractionButtonComponentData
      ? D
      : never
    : never,
  InnerHandler extends Option.Option.Value<Handler> extends infer H
    ? H extends AnyInteractionHandler<ButtonInteraction>
      ? H
      : never
    : never = Option.Option.Value<Handler> extends infer H
    ? H extends AnyInteractionHandler<ButtonInteraction>
      ? H
      : never
    : never,
> extends Data.TaggedClass("ButtonInteractionHandlerContextBuilder")<{
  builder: InteractionHandlerContextBuilder<Data, Handler>;
}> {
  static empty() {
    return new ButtonInteractionHandlerContextBuilder({
      builder: InteractionHandlerContextBuilder.empty<
        InteractionButtonComponentData,
        AnyInteractionHandler<ButtonInteraction>
      >(),
    });
  }

  data<BuilderData extends InteractionButtonComponentData>(
    this: ButtonInteractionHandlerContextBuilder<
      Option.None<InteractionButtonComponentData>,
      Handler
    >,
    data: BuilderData,
  ) {
    return new ButtonInteractionHandlerContextBuilder({
      builder: this.builder.data(data),
    });
  }

  handler<BuilderHandler extends AnyInteractionHandler<ButtonInteraction>>(
    this: ButtonInteractionHandlerContextBuilder<
      Data,
      Option.None<AnyInteractionHandler<ButtonInteraction>>
    >,
    handler: BuilderHandler,
  ) {
    return new ButtonInteractionHandlerContextBuilder({
      builder: this.builder.handler(handler),
    });
  }

  build(
    this: ButtonInteractionHandlerContextBuilder<
      Option.Some<InnerData>,
      Option.Some<InnerHandler>
    >,
  ) {
    return ButtonInteractionHandlerContext.fromBuilderContext(this.builder);
  }
}

export class ChatInputCommandHandlerContext<
  E = unknown,
  R = unknown,
> extends Data.TaggedClass("ChatInputCommandHandlerContext")<
  InteractionHandlerContextData<
    SharedSlashCommand,
    AnyInteractionHandler<ChatInputCommandInteraction, E, R>
  >
> {
  static make<
    Data extends SharedSlashCommand,
    Handler extends AnyInteractionHandler<ChatInputCommandInteraction>,
    E = Effect.Effect.Error<ReturnType<Handler>>,
    R = Effect.Effect.Context<ReturnType<Handler>>,
  >(context: InteractionHandlerContextData<Data, Handler>) {
    return new ChatInputCommandHandlerContext<E, R>(context);
  }

  static fromBuilderContext<
    Context extends InteractionHandlerContextBuilderData<
      Option.Some<SharedSlashCommand>,
      Option.Some<AnyInteractionHandler<ChatInputCommandInteraction>>
    >,
  >(context: Context) {
    return ChatInputCommandHandlerContext.make(
      InteractionHandlerContext.fromBuilderContext(context),
    );
  }
}

export class ChatInputCommandHandlerContextBuilder<
  Data extends
    Option.Option<SharedSlashCommand> = Option.None<SharedSlashCommand>,
  Handler extends Option.Option<
    AnyInteractionHandler<ChatInputCommandInteraction>
  > = Option.None<AnyInteractionHandler<ChatInputCommandInteraction>>,
  InnerData extends Option.Option.Value<Data> extends infer D
    ? D extends SharedSlashCommand
      ? D
      : never
    : never = Option.Option.Value<Data> extends infer D
    ? D extends SharedSlashCommand
      ? D
      : never
    : never,
  InnerHandler extends Option.Option.Value<Handler> extends infer H
    ? H extends AnyInteractionHandler<ChatInputCommandInteraction>
      ? H
      : never
    : never = Option.Option.Value<Handler> extends infer H
    ? H extends AnyInteractionHandler<ChatInputCommandInteraction>
      ? H
      : never
    : never,
> extends Data.TaggedClass("ChatInputCommandHandlerContextBuilder")<{
  builder: InteractionHandlerContextBuilder<Data, Handler>;
}> {
  static empty() {
    return new ChatInputCommandHandlerContextBuilder({
      builder: InteractionHandlerContextBuilder.empty<
        SharedSlashCommand,
        AnyInteractionHandler<ChatInputCommandInteraction>
      >(),
    });
  }

  data<BuilderData extends SharedSlashCommand>(
    this: ChatInputCommandHandlerContextBuilder<
      Option.None<SharedSlashCommand>,
      Handler
    >,
    data: BuilderData,
  ) {
    return new ChatInputCommandHandlerContextBuilder({
      builder: this.builder.data(data),
    });
  }

  handler<
    BuilderHandler extends AnyInteractionHandler<ChatInputCommandInteraction>,
  >(
    this: ChatInputCommandHandlerContextBuilder<Data>,
    handler: BuilderHandler,
  ) {
    return new ChatInputCommandHandlerContextBuilder({
      builder: this.builder.handler(handler),
    });
  }

  build(
    this: ChatInputCommandHandlerContextBuilder<
      Option.Some<InnerData>,
      Option.Some<InnerHandler>
    >,
  ) {
    return ChatInputCommandHandlerContext.fromBuilderContext(this.builder);
  }
}

export class ChatInputSubcommandGroupHandlerContext<
  E = unknown,
  R = unknown,
> extends Data.TaggedClass("ChatInputSubcommandGroupHandlerContext")<
  InteractionHandlerContextData<
    SlashCommandSubcommandGroupBuilder,
    AnyInteractionHandler<ChatInputCommandInteraction, E, R>
  >
> {
  static make<
    Data extends SlashCommandSubcommandGroupBuilder,
    Handler extends AnyInteractionHandler<ChatInputCommandInteraction>,
    E = Effect.Effect.Error<ReturnType<Handler>>,
    R = Effect.Effect.Context<ReturnType<Handler>>,
  >(context: InteractionHandlerContextData<Data, Handler>) {
    return new ChatInputSubcommandGroupHandlerContext<E, R>(context);
  }

  static fromBuilderContext<
    Context extends InteractionHandlerContextBuilderData<
      Option.Some<SlashCommandSubcommandGroupBuilder>,
      Option.Some<AnyInteractionHandler<ChatInputCommandInteraction>>
    >,
  >(context: Context) {
    return ChatInputSubcommandGroupHandlerContext.make(
      InteractionHandlerContext.fromBuilderContext(context),
    );
  }
}

export class ChatInputSubcommandGroupHandlerContextBuilder<
  Data extends
    Option.Option<SlashCommandSubcommandGroupBuilder> = Option.None<SlashCommandSubcommandGroupBuilder>,
  Handler extends Option.Option<
    AnyInteractionHandler<ChatInputCommandInteraction>
  > = Option.None<AnyInteractionHandler<ChatInputCommandInteraction>>,
  InnerData extends Option.Option.Value<Data> extends infer D
    ? D extends SlashCommandSubcommandGroupBuilder
      ? D
      : never
    : never = Option.Option.Value<Data> extends infer D
    ? D extends SlashCommandSubcommandGroupBuilder
      ? D
      : never
    : never,
  InnerHandler extends Option.Option.Value<Handler> extends infer H
    ? H extends AnyInteractionHandler<ChatInputCommandInteraction>
      ? H
      : never
    : never = Option.Option.Value<Handler> extends infer H
    ? H extends AnyInteractionHandler<ChatInputCommandInteraction>
      ? H
      : never
    : never,
> extends Data.TaggedClass("ChatInputSubcommandGroupHandlerContextBuilder")<{
  builder: InteractionHandlerContextBuilder<Data, Handler>;
}> {
  static empty() {
    return new ChatInputSubcommandGroupHandlerContextBuilder({
      builder: InteractionHandlerContextBuilder.empty<
        SlashCommandSubcommandGroupBuilder,
        AnyInteractionHandler<ChatInputCommandInteraction>
      >(),
    });
  }

  data<BuilderData extends SlashCommandSubcommandGroupBuilder>(
    this: ChatInputSubcommandGroupHandlerContextBuilder<
      Option.None<SlashCommandSubcommandGroupBuilder>,
      Handler
    >,
    data: BuilderData,
  ) {
    return new ChatInputSubcommandGroupHandlerContextBuilder({
      builder: this.builder.data(data),
    });
  }

  handler<
    BuilderHandler extends AnyInteractionHandler<ChatInputCommandInteraction>,
  >(
    this: ChatInputSubcommandGroupHandlerContextBuilder<Data>,
    handler: BuilderHandler,
  ) {
    return new ChatInputSubcommandGroupHandlerContextBuilder({
      builder: this.builder.handler(handler),
    });
  }

  build(
    this: ChatInputSubcommandGroupHandlerContextBuilder<
      Option.Some<InnerData>,
      Option.Some<InnerHandler>
    >,
  ) {
    return ChatInputSubcommandGroupHandlerContext.fromBuilderContext(
      this.builder,
    );
  }
}

export class ChatInputSubcommandHandlerContext<
  E = unknown,
  R = unknown,
> extends Data.TaggedClass("ChatInputSubcommandHandlerContext")<
  InteractionHandlerContextData<
    SlashCommandSubcommandBuilder,
    AnyInteractionHandler<ChatInputCommandInteraction, E, R>
  >
> {
  static make<
    Data extends SlashCommandSubcommandBuilder,
    Handler extends AnyInteractionHandler<ChatInputCommandInteraction>,
    E = Effect.Effect.Error<ReturnType<Handler>>,
    R = Effect.Effect.Context<ReturnType<Handler>>,
  >(context: InteractionHandlerContextData<Data, Handler>) {
    return new ChatInputSubcommandHandlerContext<E, R>(context);
  }

  static fromBuilderContext<
    Context extends InteractionHandlerContextBuilderData<
      Option.Some<SlashCommandSubcommandBuilder>,
      Option.Some<AnyInteractionHandler<ChatInputCommandInteraction>>
    >,
  >(context: Context) {
    return ChatInputSubcommandHandlerContext.make(
      InteractionHandlerContext.fromBuilderContext(context),
    );
  }
}

export class ChatInputSubcommandHandlerContextBuilder<
  Data extends
    Option.Option<SlashCommandSubcommandBuilder> = Option.None<SlashCommandSubcommandBuilder>,
  Handler extends Option.Option<
    AnyInteractionHandler<ChatInputCommandInteraction>
  > = Option.None<AnyInteractionHandler<ChatInputCommandInteraction>>,
  InnerData extends Option.Option.Value<Data> extends infer D
    ? D extends SlashCommandSubcommandBuilder
      ? D
      : never
    : never = Option.Option.Value<Data> extends infer D
    ? D extends SlashCommandSubcommandBuilder
      ? D
      : never
    : never,
  InnerHandler extends Option.Option.Value<Handler> extends infer H
    ? H extends AnyInteractionHandler<ChatInputCommandInteraction>
      ? H
      : never
    : never = Option.Option.Value<Handler> extends infer H
    ? H extends AnyInteractionHandler<ChatInputCommandInteraction>
      ? H
      : never
    : never,
> extends Data.TaggedClass("ChatInputSubcommandHandlerContextBuilder")<{
  builder: InteractionHandlerContextBuilder<Data, Handler>;
}> {
  static empty() {
    return new ChatInputSubcommandHandlerContextBuilder({
      builder: InteractionHandlerContextBuilder.empty<
        SlashCommandSubcommandBuilder,
        AnyInteractionHandler<ChatInputCommandInteraction>
      >(),
    });
  }

  data<BuilderData extends SlashCommandSubcommandBuilder>(
    this: ChatInputSubcommandHandlerContextBuilder<
      Option.None<SlashCommandSubcommandBuilder>,
      Handler
    >,
    data: BuilderData,
  ) {
    return new ChatInputSubcommandHandlerContextBuilder({
      builder: this.builder.data(data),
    });
  }

  handler<
    BuilderHandler extends AnyInteractionHandler<ChatInputCommandInteraction>,
  >(
    this: ChatInputSubcommandHandlerContextBuilder<Data>,
    handler: BuilderHandler,
  ) {
    return new ChatInputSubcommandHandlerContextBuilder({
      builder: this.builder.handler(handler),
    });
  }

  build(
    this: ChatInputSubcommandHandlerContextBuilder<
      Option.Some<InnerData>,
      Option.Some<InnerHandler>
    >,
  ) {
    return ChatInputSubcommandHandlerContext.fromBuilderContext(this.builder);
  }
}

export const buttonInteractionHandlerContextBuilder = () =>
  ButtonInteractionHandlerContextBuilder.empty();

export const chatInputCommandHandlerContextBuilder = () =>
  ChatInputCommandHandlerContextBuilder.empty();

export const chatInputSubcommandGroupHandlerContextBuilder = () =>
  ChatInputSubcommandGroupHandlerContextBuilder.empty();

export const chatInputSubcommandHandlerContextBuilder = () =>
  ChatInputSubcommandHandlerContextBuilder.empty();

export class InteractionHandlerMap<
  Context extends InteractionHandlerContextData,
  Data extends Context extends InteractionHandlerContextData<infer D>
    ? D
    : never = Context extends InteractionHandlerContextData<infer D>
    ? D
    : never,
> extends Data.TaggedClass("InteractionHandlerMap")<{
  map: HashMap.HashMap<string, Context>;
  keyGetter: (data: Data) => string;
}> {
  static empty<
    Context extends InteractionHandlerContextData,
    Data extends Context extends InteractionHandlerContextData<infer D>
      ? D
      : never = Context extends InteractionHandlerContextData<infer D>
      ? D
      : never,
  >(keyGetter: (data: Data) => string) {
    return new InteractionHandlerMap<Context, Data>({
      map: HashMap.empty(),
      keyGetter,
    });
  }

  static add<Context extends InteractionHandlerContextData>(context: Context) {
    return <
      Map extends AnyInteractionHandlerMap,
      MapContext extends Map extends InteractionHandlerMap<infer C>
        ? C
        : never = Map extends InteractionHandlerMap<infer C> ? C : never,
    >(
      map: Map,
    ) =>
      new InteractionHandlerMap({
        map: HashMap.set(
          map.map as HashMap.HashMap<string, MapContext | Context>,
          map.keyGetter(context.data),
          context,
        ),
        keyGetter: map.keyGetter,
      });
  }

  static get(key: string) {
    return <Context extends InteractionHandlerContextData>(
      map: InteractionHandlerMap<Context>,
    ) => HashMap.get(map.map, key);
  }

  static union<
    Map extends AnyInteractionHandlerMap,
    MapContext extends Map extends InteractionHandlerMap<infer C>
      ? C
      : never = Map extends InteractionHandlerMap<infer C> ? C : never,
  >(map: Map) {
    return <
      OtherMap extends AnyInteractionHandlerMap,
      OtherMapContext extends OtherMap extends InteractionHandlerMap<infer C>
        ? C
        : never = OtherMap extends InteractionHandlerMap<infer C> ? C : never,
    >(
      other: OtherMap,
    ) =>
      new InteractionHandlerMap({
        map: HashMap.union(
          map.map as HashMap.HashMap<string, MapContext | OtherMapContext>,
          other.map as HashMap.HashMap<string, MapContext | OtherMapContext>,
        ),
        keyGetter: map.keyGetter,
      });
  }

  static values<Map extends AnyInteractionHandlerMap>(map: Map) {
    return HashMap.values(map.map);
  }
}

type AnyInteractionHandlerMap<
  Context extends InteractionHandlerContextData = InteractionHandlerContextData,
  Data extends Context extends InteractionHandlerContextData<infer D>
    ? D
    : // eslint-disable-next-line @typescript-eslint/no-explicit-any
      never = any,
> = InteractionHandlerMap<Context, Data>;

export class ButtonInteractionHandlerMap<
  out E = never,
  out R = never,
> extends Data.TaggedClass("ButtonInteractionHandlerMap")<{
  map: InteractionHandlerMap<
    ButtonInteractionHandlerContext<E, R>,
    InteractionButtonComponentData
  >;
}> {
  static empty<E = never, R = never>() {
    return new ButtonInteractionHandlerMap<E, R>({
      map: InteractionHandlerMap.empty((data) => data.customId),
    });
  }

  static add<E = never, R = never>(
    handler: ButtonInteractionHandlerContext<E, R>,
  ) {
    return <ME = never, MR = never>(map: ButtonInteractionHandlerMap<ME, MR>) =>
      new ButtonInteractionHandlerMap({
        map: InteractionHandlerMap.add(handler)(
          map.map,
        ) as InteractionHandlerMap<
          ButtonInteractionHandlerContext<ME | E, MR | R>,
          InteractionButtonComponentData
        >,
      });
  }

  static get(key: string) {
    return <E = never, R = never>(map: ButtonInteractionHandlerMap<E, R>) =>
      InteractionHandlerMap.get(key)(map.map);
  }

  static union<E = never, R = never>(map: ButtonInteractionHandlerMap<E, R>) {
    return <ME = never, MR = never>(
      other: ButtonInteractionHandlerMap<ME, MR>,
    ) =>
      new ButtonInteractionHandlerMap({
        map: InteractionHandlerMap.union(map.map)(
          other.map,
        ) as InteractionHandlerMap<
          ButtonInteractionHandlerContext<E | ME, R | MR>,
          InteractionButtonComponentData
        >,
      });
  }

  static values<E = never, R = never>(map: ButtonInteractionHandlerMap<E, R>) {
    return InteractionHandlerMap.values(map.map) as IterableIterator<
      ButtonInteractionHandlerContext<E, R>
    >;
  }
}

export class ChatInputCommandHandlerMap<
  out E = never,
  out R = never,
> extends Data.TaggedClass("ChatInputCommandHandlerMap")<{
  map: InteractionHandlerMap<
    ChatInputCommandHandlerContext<E, R>,
    SharedSlashCommand
  >;
}> {
  static empty<E = never, R = never>() {
    return new ChatInputCommandHandlerMap<E, R>({
      map: InteractionHandlerMap.empty((data) => data.name),
    });
  }

  static add<E = never, R = never>(
    handler: ChatInputCommandHandlerContext<E, R>,
  ) {
    return <ME = never, MR = never>(map: ChatInputCommandHandlerMap<ME, MR>) =>
      new ChatInputCommandHandlerMap({
        map: InteractionHandlerMap.add(handler)(
          map.map,
        ) as InteractionHandlerMap<
          ChatInputCommandHandlerContext<ME | E, MR | R>,
          SharedSlashCommand
        >,
      });
  }

  static get(key: string) {
    return <E = never, R = never>(map: ChatInputCommandHandlerMap<E, R>) =>
      InteractionHandlerMap.get(key)(map.map);
  }

  static union<E = never, R = never>(map: ChatInputCommandHandlerMap<E, R>) {
    return <ME = never, MR = never>(
      other: ChatInputCommandHandlerMap<ME, MR>,
    ) =>
      new ChatInputCommandHandlerMap({
        map: InteractionHandlerMap.union(map.map)(
          other.map,
        ) as InteractionHandlerMap<
          ChatInputCommandHandlerContext<E | ME, R | MR>,
          SharedSlashCommand
        >,
      });
  }

  static values<E = never, R = never>(map: ChatInputCommandHandlerMap<E, R>) {
    return InteractionHandlerMap.values(map.map) as IterableIterator<
      ChatInputCommandHandlerContext<E, R>
    >;
  }
}

export class ChatInputSubcommandGroupHandlerMap<
  out E = never,
  out R = never,
> extends Data.TaggedClass("ChatInputSubcommandGroupHandlerMap")<{
  map: InteractionHandlerMap<
    ChatInputSubcommandGroupHandlerContext<E, R>,
    SlashCommandSubcommandGroupBuilder
  >;
}> {
  static empty<E = never, R = never>() {
    return new ChatInputSubcommandGroupHandlerMap<E, R>({
      map: InteractionHandlerMap.empty((data) => data.name),
    });
  }

  static add<E = never, R = never>(
    handler: ChatInputSubcommandGroupHandlerContext<E, R>,
  ) {
    return <ME = never, MR = never>(
      map: ChatInputSubcommandGroupHandlerMap<ME, MR>,
    ) =>
      new ChatInputSubcommandGroupHandlerMap({
        map: InteractionHandlerMap.add(handler)(
          map.map,
        ) as InteractionHandlerMap<
          ChatInputSubcommandGroupHandlerContext<ME | E, MR | R>,
          SlashCommandSubcommandGroupBuilder
        >,
      });
  }

  static get(key: string) {
    return <E = never, R = never>(
      map: ChatInputSubcommandGroupHandlerMap<E, R>,
    ) => InteractionHandlerMap.get(key)(map.map);
  }

  static union<E = never, R = never>(
    map: ChatInputSubcommandGroupHandlerMap<E, R>,
  ) {
    return <ME = never, MR = never>(
      other: ChatInputSubcommandGroupHandlerMap<ME, MR>,
    ) =>
      new ChatInputSubcommandGroupHandlerMap({
        map: InteractionHandlerMap.union(map.map)(
          other.map,
        ) as InteractionHandlerMap<
          ChatInputSubcommandGroupHandlerContext<E | ME, R | MR>,
          SlashCommandSubcommandGroupBuilder
        >,
      });
  }

  static values<E = never, R = never>(
    map: ChatInputSubcommandGroupHandlerMap<E, R>,
  ) {
    return InteractionHandlerMap.values(map.map) as IterableIterator<
      ChatInputSubcommandGroupHandlerContext<E, R>
    >;
  }
}

export class ChatInputSubcommandHandlerMap<
  out E = never,
  out R = never,
> extends Data.TaggedClass("ChatInputSubcommandHandlerMap")<{
  map: InteractionHandlerMap<
    ChatInputSubcommandHandlerContext<E, R>,
    SlashCommandSubcommandBuilder
  >;
}> {
  static empty<E = never, R = never>() {
    return new ChatInputSubcommandHandlerMap<E, R>({
      map: InteractionHandlerMap.empty((data) => data.name),
    });
  }

  static add<E = never, R = never>(
    handler: ChatInputSubcommandHandlerContext<E, R>,
  ) {
    return <ME = never, MR = never>(
      map: ChatInputSubcommandHandlerMap<ME, MR>,
    ) =>
      new ChatInputSubcommandHandlerMap({
        map: InteractionHandlerMap.add(handler)(
          map.map,
        ) as InteractionHandlerMap<
          ChatInputSubcommandHandlerContext<ME | E, MR | R>,
          SlashCommandSubcommandBuilder
        >,
      });
  }

  static get(key: string) {
    return <E = never, R = never>(map: ChatInputSubcommandHandlerMap<E, R>) =>
      InteractionHandlerMap.get(key)(map.map);
  }

  static union<E = never, R = never>(map: ChatInputSubcommandHandlerMap<E, R>) {
    return <ME = never, MR = never>(
      other: ChatInputSubcommandHandlerMap<ME, MR>,
    ) =>
      new ChatInputSubcommandHandlerMap({
        map: InteractionHandlerMap.union(map.map)(
          other.map,
        ) as InteractionHandlerMap<
          ChatInputSubcommandHandlerContext<E | ME, R | MR>,
          SlashCommandSubcommandBuilder
        >,
      });
  }

  static values<E = never, R = never>(
    map: ChatInputSubcommandHandlerMap<E, R>,
  ) {
    return InteractionHandlerMap.values(map.map) as IterableIterator<
      ChatInputSubcommandHandlerContext<E, R>
    >;
  }
}

export class SubcommandHandler<out E = never, out R = never> {
  readonly subcommandGroupHandlerMap: ChatInputSubcommandGroupHandlerMap<E, R>;
  readonly subcommandHandlerMap: ChatInputSubcommandHandlerMap<E, R>;

  constructor(
    subcommandGroupHandlerMap: ChatInputSubcommandGroupHandlerMap<E, R>,
    subcommandHandlerMap: ChatInputSubcommandHandlerMap<E, R>,
  ) {
    this.subcommandGroupHandlerMap = subcommandGroupHandlerMap;
    this.subcommandHandlerMap = subcommandHandlerMap;
  }

  static empty<E = never, R = never>() {
    return new SubcommandHandler<E, R>(
      ChatInputSubcommandGroupHandlerMap.empty(),
      ChatInputSubcommandHandlerMap.empty(),
    );
  }

  static addSubcommandGroupHandler<E = never, R = never>(
    handler: ChatInputSubcommandGroupHandlerContext<E, R>,
  ) {
    return <ME = never, MR = never>(map: SubcommandHandler<ME, MR>) =>
      new SubcommandHandler<E | ME, R | MR>(
        ChatInputSubcommandGroupHandlerMap.add(handler)(
          map.subcommandGroupHandlerMap,
        ),
        map.subcommandHandlerMap,
      );
  }

  static addSubcommandGroupHandlerMap<E = never, R = never>(
    handlerMap: ChatInputSubcommandGroupHandlerMap<E, R>,
  ) {
    return <ME = never, MR = never>(map: SubcommandHandler<ME, MR>) =>
      new SubcommandHandler<E | ME, R | MR>(
        ChatInputSubcommandGroupHandlerMap.union(handlerMap)(
          map.subcommandGroupHandlerMap,
        ),
        map.subcommandHandlerMap,
      );
  }

  static addSubcommandHandler<E = never, R = never>(
    handler: ChatInputSubcommandHandlerContext<E, R>,
  ) {
    return <ME = never, MR = never>(map: SubcommandHandler<ME, MR>) =>
      new SubcommandHandler<E | ME, R | MR>(
        map.subcommandGroupHandlerMap,
        ChatInputSubcommandHandlerMap.add(handler)(map.subcommandHandlerMap),
      );
  }

  static addSubcommandHandlerMap<E = never, R = never>(
    handlerMap: ChatInputSubcommandHandlerMap<E, R>,
  ) {
    return <ME = never, MR = never>(map: SubcommandHandler<ME, MR>) =>
      new SubcommandHandler<E | ME, R | MR>(
        map.subcommandGroupHandlerMap,
        ChatInputSubcommandHandlerMap.union(handlerMap)(
          map.subcommandHandlerMap,
        ),
      );
  }

  static handler<E = never, R = never>(handler: SubcommandHandler<E, R>) {
    return (interaction: ChatInputCommandInteraction) =>
      pipe(
        Option.fromNullable(interaction.options.getSubcommandGroup()),
        Option.flatMap((group) =>
          ChatInputSubcommandGroupHandlerMap.get(group)(
            handler.subcommandGroupHandlerMap,
          ),
        ),
        Option.map((ctx) => ctx.handler),
        Option.orElse(() =>
          pipe(
            Option.fromNullable(interaction.options.getSubcommand()),
            Option.flatMap((subcommand) =>
              ChatInputSubcommandHandlerMap.get(subcommand)(
                handler.subcommandHandlerMap,
              ),
            ),
            Option.map((ctx) => ctx.handler),
          ),
        ),
        Option.getOrElse<
          InteractionHandler<ChatInputCommandInteraction, never, never>
        >(() => () => Effect.succeed(undefined)),
        (handler) => handler(interaction),
      );
  }
}
