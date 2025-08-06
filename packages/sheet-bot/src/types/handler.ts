import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  Interaction,
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

export type InteractionHandler<
  I extends Interaction = Interaction,
  E = never,
  R = never,
> = Effect.Effect<unknown, E, R | InteractionContext<I>>;

export type AnyInteractionHandler<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  I extends Interaction = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  E = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  R = any,
> = InteractionHandler<I, E, R>;

type InteractionHandlerInteraction<H extends AnyInteractionHandler> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  H extends InteractionHandler<infer I extends Interaction, any, any>
    ? I
    : never;

type InteractionHandlerError<H extends AnyInteractionHandler> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  H extends InteractionHandler<any, infer E, any> ? E : never;

type InteractionHandlerRequirement<H extends AnyInteractionHandler> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  H extends InteractionHandler<any, any, infer R> ? R : never;

type InferInteractionHandler<Handler extends AnyInteractionHandler> =
  InteractionHandler<
    InteractionHandlerInteraction<Handler>,
    InteractionHandlerError<Handler>,
    InteractionHandlerRequirement<Handler>
  >;

export type InteractionHandlerContextObject<
  Data = unknown,
  Handler extends AnyInteractionHandler = AnyInteractionHandler,
> = {
  data: Data;
  handler: Handler;
};

export type AnyInteractionHandlerContextObject<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Data = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Handler extends AnyInteractionHandler = any,
> = InteractionHandlerContextObject<Data, Handler>;

export class InteractionHandlerContext<
  Data = unknown,
  Handler extends AnyInteractionHandler = AnyInteractionHandler,
> extends Data.TaggedClass("InteractionHandlerContext")<
  InteractionHandlerContextObject<Data, Handler>
> {}

type AnyInteractionHandlerContext<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Data = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Handler extends AnyInteractionHandler = any,
> = InteractionHandlerContext<Data, Handler>;

type InteractionHandlerContextData<
  Context extends AnyInteractionHandlerContext,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
> = Context extends AnyInteractionHandlerContext<infer D, any> ? D : never;

export type AnyButtonInteractionHandlerContext<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  E = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  R = any,
> = InteractionHandlerContext<
  InteractionButtonComponentData,
  AnyInteractionHandler<ButtonInteraction, E, R>
>;

export type AnyChatInputCommandHandlerContext<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  E = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  R = any,
> = InteractionHandlerContext<
  SharedSlashCommand,
  AnyInteractionHandler<ChatInputCommandInteraction, E, R>
>;

export type AnyChatInputSubcommandGroupHandlerContext<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  E = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  R = any,
> = InteractionHandlerContext<
  SlashCommandSubcommandGroupBuilder,
  AnyInteractionHandler<ChatInputCommandInteraction, E, R>
>;

export type AnyChatInputSubcommandHandlerContext<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  E = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  R = any,
> = InteractionHandlerContext<
  SlashCommandSubcommandBuilder,
  AnyInteractionHandler<ChatInputCommandInteraction, E, R>
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
      _data: Option.some(data) as Option.Some<BuilderData>,
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
    AnyInteractionHandler<ButtonInteraction>
  >();

export const chatInputCommandHandlerContextBuilder = () =>
  InteractionHandlerContextBuilder.empty<
    SharedSlashCommand,
    AnyInteractionHandler<ChatInputCommandInteraction>
  >();

export const chatInputSubcommandGroupHandlerContextBuilder = () =>
  InteractionHandlerContextBuilder.empty<
    SlashCommandSubcommandGroupBuilder,
    AnyInteractionHandler<ChatInputCommandInteraction>
  >();

export const chatInputSubcommandHandlerContextBuilder = () =>
  InteractionHandlerContextBuilder.empty<
    SlashCommandSubcommandBuilder,
    AnyInteractionHandler<ChatInputCommandInteraction>
  >();

export type InteractionHandlerMapObject<
  Context extends AnyInteractionHandlerContext,
  Data extends
    InteractionHandlerContextData<Context> = InteractionHandlerContextData<Context>,
> = {
  map: HashMap.HashMap<string, Context>;
  keyGetter: (data: Data) => string;
};

export class InteractionHandlerMap<
  Context extends AnyInteractionHandlerContext,
  Data extends
    InteractionHandlerContextData<Context> = InteractionHandlerContextData<Context>,
> extends Data.TaggedClass("InteractionHandlerMap")<
  InteractionHandlerMapObject<Context, Data>
> {
  static empty<
    Context extends AnyInteractionHandlerContext,
    Data extends
      InteractionHandlerContextData<Context> = InteractionHandlerContextData<Context>,
  >(keyGetter: (data: Data) => string) {
    return new InteractionHandlerMap<Context, Data>({
      map: HashMap.empty(),
      keyGetter,
    });
  }

  static add<Context extends AnyInteractionHandlerContext>(context: Context) {
    return <
      Map extends AnyInteractionHandlerMap,
      MapContext extends
        InteractionHandlerMapContext<Map> = InteractionHandlerMapContext<Map>,
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
    return <Context extends AnyInteractionHandlerContext>(
      map: InteractionHandlerMap<Context>,
    ) => HashMap.get(map.map, key);
  }

  static union<
    Map extends AnyInteractionHandlerMap,
    MapContext extends
      InteractionHandlerMapContext<Map> = InteractionHandlerMapContext<Map>,
  >(map: Map) {
    return <
      OtherMap extends AnyInteractionHandlerMap,
      OtherMapContext extends
        InteractionHandlerMapContext<OtherMap> = InteractionHandlerMapContext<OtherMap>,
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Context extends AnyInteractionHandlerContext = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
> = InteractionHandlerMap<Context, any>;

type InteractionHandlerMapContext<
  Map extends AnyInteractionHandlerMap,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
> = Map extends InteractionHandlerMap<infer C, any> ? C : never;

export class ButtonInteractionHandlerMap<
  out E = never,
  out R = never,
> extends Data.TaggedClass("ButtonInteractionHandlerMap")<{
  map: InteractionHandlerMap<AnyButtonInteractionHandlerContext<E, R>>;
}> {
  static empty<E = never, R = never>() {
    return new ButtonInteractionHandlerMap<E, R>({
      map: InteractionHandlerMap.empty((data) => data.customId),
    });
  }

  static add<E = never, R = never>(
    handler: AnyButtonInteractionHandlerContext<E, R>,
  ) {
    return <ME = never, MR = never>(map: ButtonInteractionHandlerMap<ME, MR>) =>
      new ButtonInteractionHandlerMap({
        map: InteractionHandlerMap.add(handler)(
          map.map,
        ) as InteractionHandlerMap<
          AnyButtonInteractionHandlerContext<ME | E, MR | R>
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
          AnyButtonInteractionHandlerContext<E | ME, R | MR>
        >,
      });
  }

  static values<E = never, R = never>(map: ButtonInteractionHandlerMap<E, R>) {
    return InteractionHandlerMap.values(map.map) as IterableIterator<
      AnyButtonInteractionHandlerContext<E, R>
    >;
  }
}

export class ChatInputCommandHandlerMap<
  out E = never,
  out R = never,
> extends Data.TaggedClass("ChatInputCommandHandlerMap")<{
  map: InteractionHandlerMap<AnyChatInputCommandHandlerContext<E, R>>;
}> {
  static empty<E = never, R = never>() {
    return new ChatInputCommandHandlerMap<E, R>({
      map: InteractionHandlerMap.empty((data) => data.name),
    });
  }

  static add<E = never, R = never>(
    handler: AnyChatInputCommandHandlerContext<E, R>,
  ) {
    return <ME = never, MR = never>(map: ChatInputCommandHandlerMap<ME, MR>) =>
      new ChatInputCommandHandlerMap({
        map: InteractionHandlerMap.add(handler)(
          map.map,
        ) as InteractionHandlerMap<
          AnyChatInputCommandHandlerContext<ME | E, MR | R>
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
          AnyChatInputCommandHandlerContext<E | ME, R | MR>
        >,
      });
  }

  static values<E = never, R = never>(map: ChatInputCommandHandlerMap<E, R>) {
    return InteractionHandlerMap.values(map.map) as IterableIterator<
      AnyChatInputCommandHandlerContext<E, R>
    >;
  }
}

export class ChatInputSubcommandGroupHandlerMap<
  out E = never,
  out R = never,
> extends Data.TaggedClass("ChatInputSubcommandGroupHandlerMap")<{
  map: InteractionHandlerMap<AnyChatInputSubcommandGroupHandlerContext<E, R>>;
}> {
  static empty<E = never, R = never>() {
    return new ChatInputSubcommandGroupHandlerMap<E, R>({
      map: InteractionHandlerMap.empty((data) => data.name),
    });
  }

  static add<E = never, R = never>(
    handler: AnyChatInputSubcommandGroupHandlerContext<E, R>,
  ) {
    return <ME = never, MR = never>(
      map: ChatInputSubcommandGroupHandlerMap<ME, MR>,
    ) =>
      new ChatInputSubcommandGroupHandlerMap({
        map: InteractionHandlerMap.add(handler)(
          map.map,
        ) as InteractionHandlerMap<
          AnyChatInputSubcommandGroupHandlerContext<ME | E, MR | R>
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
          AnyChatInputSubcommandGroupHandlerContext<E | ME, R | MR>
        >,
      });
  }

  static values<E = never, R = never>(
    map: ChatInputSubcommandGroupHandlerMap<E, R>,
  ) {
    return InteractionHandlerMap.values(map.map) as IterableIterator<
      AnyChatInputSubcommandGroupHandlerContext<E, R>
    >;
  }
}

export class ChatInputSubcommandHandlerMap<
  out E = never,
  out R = never,
> extends Data.TaggedClass("ChatInputSubcommandHandlerMap")<{
  map: InteractionHandlerMap<AnyChatInputSubcommandHandlerContext<E, R>>;
}> {
  static empty<E = never, R = never>() {
    return new ChatInputSubcommandHandlerMap<E, R>({
      map: InteractionHandlerMap.empty((data) => data.name),
    });
  }

  static add<E = never, R = never>(
    handler: AnyChatInputSubcommandHandlerContext<E, R>,
  ) {
    return <ME = never, MR = never>(
      map: ChatInputSubcommandHandlerMap<ME, MR>,
    ) =>
      new ChatInputSubcommandHandlerMap({
        map: InteractionHandlerMap.add(handler)(
          map.map,
        ) as InteractionHandlerMap<
          AnyChatInputSubcommandHandlerContext<ME | E, MR | R>
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
          AnyChatInputSubcommandHandlerContext<E | ME, R | MR>
        >,
      });
  }

  static values<E = never, R = never>(
    map: ChatInputSubcommandHandlerMap<E, R>,
  ) {
    return InteractionHandlerMap.values(map.map) as IterableIterator<
      AnyChatInputSubcommandHandlerContext<E, R>
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
    handler: AnyChatInputSubcommandGroupHandlerContext<E, R>,
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
    handler: AnyChatInputSubcommandHandlerContext<E, R>,
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
    return pipe(
      InteractionContext.interaction<ChatInputCommandInteraction>(),
      Effect.flatMap((interaction) =>
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
          >(() => Effect.succeed(undefined)),
        ),
      ),
    );
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnySubcommandHandler<E = any, R = any> = SubcommandHandler<E, R>;

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
  Handler extends AnySubcommandHandler = AnySubcommandHandler,
> = {
  _data: Data;
  _handler: Handler;
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
  Handler extends AnySubcommandHandler = AnySubcommandHandler,
> extends Data.TaggedClass(
  "InteractionHandlerContextWithSubcommandHandlerBuilder",
)<InteractionHandlerContextWithSubcommandHandlerBuilderData<Data, Handler>> {
  static empty<
    BuilderData extends
      | SlashCommandBuilder
      | SlashCommandSubcommandsOnlyBuilder
      | SlashCommandSubcommandGroupBuilder,
  >() {
    return new InteractionHandlerContextWithSubcommandHandlerBuilder({
      _data: Option.none() as Option.None<BuilderData>,
      _handler: SubcommandHandler.empty(),
    });
  }

  data<
    BuilderData extends
      | SlashCommandBuilder
      | SlashCommandSubcommandsOnlyBuilder
      | SlashCommandSubcommandGroupBuilder,
    BuilderHandler extends AnySubcommandHandler,
  >(
    this: InteractionHandlerContextWithSubcommandHandlerBuilder<
      Option.None<
        | SlashCommandBuilder
        | SlashCommandSubcommandsOnlyBuilder
        | SlashCommandSubcommandGroupBuilder
      >,
      BuilderHandler
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
    BuilderHandler extends AnySubcommandHandler,
    AddBuilderHandler extends AnyChatInputSubcommandHandlerContext,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ME = BuilderHandler extends SubcommandHandler<infer ME, any> ? ME : never,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    MR = BuilderHandler extends SubcommandHandler<any, infer MR> ? MR : never,
    E = AddBuilderHandler extends AnyChatInputSubcommandHandlerContext<
      infer E,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      any
    >
      ? E
      : never,
    R = AddBuilderHandler extends AnyChatInputSubcommandHandlerContext<
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      any,
      infer R
    >
      ? R
      : never,
  >(
    this: InteractionHandlerContextWithSubcommandHandlerBuilder<
      Option.Some<BuilderData>,
      BuilderHandler
    >,
    handler: AddBuilderHandler,
  ) {
    return new InteractionHandlerContextWithSubcommandHandlerBuilder({
      _data: Option.some(
        this._data.value.addSubcommand(handler.data),
      ) as Option.Some<
        BuilderData extends SlashCommandSubcommandGroupBuilder
          ? SlashCommandSubcommandGroupBuilder
          : SlashCommandSubcommandsOnlyBuilder
      >,
      _handler: SubcommandHandler.addSubcommandHandler<E, R>(handler)<ME, MR>(
        this._handler,
      ),
    });
  }

  addSubcommandGroupHandler<
    BuilderData extends
      | SlashCommandBuilder
      | SlashCommandSubcommandsOnlyBuilder,
    BuilderHandler extends AnySubcommandHandler,
    AddBuilderHandler extends AnyChatInputSubcommandGroupHandlerContext,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ME = BuilderHandler extends SubcommandHandler<infer ME, any> ? ME : never,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    MR = BuilderHandler extends SubcommandHandler<any, infer MR> ? MR : never,
    E = AddBuilderHandler extends AnyChatInputSubcommandGroupHandlerContext<
      infer E,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      any
    >
      ? E
      : never,
    R = AddBuilderHandler extends AnyChatInputSubcommandGroupHandlerContext<
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      any,
      infer R
    >
      ? R
      : never,
  >(
    this: InteractionHandlerContextWithSubcommandHandlerBuilder<
      Option.Some<BuilderData>,
      BuilderHandler
    >,
    handler: AddBuilderHandler,
  ) {
    return new InteractionHandlerContextWithSubcommandHandlerBuilder({
      _data: Option.some(
        this._data.value.addSubcommandGroup(handler.data),
      ) as Option.Some<SlashCommandSubcommandsOnlyBuilder>,
      _handler: SubcommandHandler.addSubcommandGroupHandler<E, R>(handler)<
        ME,
        MR
      >(this._handler),
    });
  }

  toContext<
    BuilderData extends
      | SlashCommandBuilder
      | SlashCommandSubcommandsOnlyBuilder
      | SlashCommandSubcommandGroupBuilder,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    E = Handler extends SubcommandHandler<infer E, any> ? E : never,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    R = Handler extends SubcommandHandler<any, infer R> ? R : never,
  >(
    this: InteractionHandlerContextWithSubcommandHandlerBuilder<
      Option.Some<BuilderData>,
      Handler
    >,
  ) {
    return {
      data: this._data.value,
      handler: SubcommandHandler.handler(this._handler),
    } as InteractionHandlerContext<
      BuilderData,
      InteractionHandler<ChatInputCommandInteraction, E, R>
    >;
  }
}

export class ChatInputCommandHandlerContextWithSubcommandHandlerBuilder<
  Data extends Option.Option<
    SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder
  > = Option.None<SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder>,
  Handler extends AnySubcommandHandler = AnySubcommandHandler,
> extends Data.TaggedClass(
  "ChatInputCommandHandlerContextWithSubcommandHandlerBuilder",
)<{
  builder: InteractionHandlerContextWithSubcommandHandlerBuilder<Data, Handler>;
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
    BuilderHandler extends AnySubcommandHandler,
  >(
    this: ChatInputCommandHandlerContextWithSubcommandHandlerBuilder<
      Option.None<SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder>,
      BuilderHandler
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
    BuilderHandler extends AnySubcommandHandler,
    AddBuilderHandler extends AnyChatInputSubcommandHandlerContext,
  >(
    this: ChatInputCommandHandlerContextWithSubcommandHandlerBuilder<
      Option.Some<BuilderData>,
      BuilderHandler
    >,
    handler: AddBuilderHandler,
  ) {
    return new ChatInputCommandHandlerContextWithSubcommandHandlerBuilder({
      builder: this.builder.addSubcommandHandler(handler),
    });
  }

  addSubcommandGroupHandler<
    BuilderData extends
      | SlashCommandBuilder
      | SlashCommandSubcommandsOnlyBuilder,
    BuilderHandler extends AnySubcommandHandler,
    AddBuilderHandler extends AnyChatInputSubcommandGroupHandlerContext,
  >(
    this: ChatInputCommandHandlerContextWithSubcommandHandlerBuilder<
      Option.Some<BuilderData>,
      BuilderHandler
    >,
    handler: AddBuilderHandler,
  ) {
    return new ChatInputCommandHandlerContextWithSubcommandHandlerBuilder({
      builder: this.builder.addSubcommandGroupHandler(handler),
    });
  }

  build<
    BuilderData extends
      | SlashCommandBuilder
      | SlashCommandSubcommandsOnlyBuilder,
    BuilderHandler extends AnySubcommandHandler,
  >(
    this: ChatInputCommandHandlerContextWithSubcommandHandlerBuilder<
      Option.Some<BuilderData>,
      BuilderHandler
    >,
  ) {
    return this.builder.toContext();
  }
}

export class ChatInputSubcommandGroupHandlerContextWithSubcommandHandlerBuilder<
  Data extends
    Option.Option<SlashCommandSubcommandGroupBuilder> = Option.None<SlashCommandSubcommandGroupBuilder>,
  Handler extends AnySubcommandHandler = AnySubcommandHandler,
> extends Data.TaggedClass(
  "ChatInputSubcommandGroupHandlerContextWithSubcommandHandlerBuilder",
)<{
  builder: InteractionHandlerContextWithSubcommandHandlerBuilder<Data, Handler>;
}> {
  static empty() {
    return new ChatInputSubcommandGroupHandlerContextWithSubcommandHandlerBuilder(
      {
        builder:
          InteractionHandlerContextWithSubcommandHandlerBuilder.empty<SlashCommandSubcommandGroupBuilder>(),
      },
    );
  }

  data<
    BuilderData extends SlashCommandSubcommandGroupBuilder,
    BuilderHandler extends AnySubcommandHandler,
  >(
    this: ChatInputSubcommandGroupHandlerContextWithSubcommandHandlerBuilder<
      Option.None<SlashCommandSubcommandGroupBuilder>,
      BuilderHandler
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
    BuilderHandler extends AnySubcommandHandler,
    AddBuilderHandler extends AnyChatInputSubcommandHandlerContext,
  >(
    this: ChatInputSubcommandGroupHandlerContextWithSubcommandHandlerBuilder<
      Option.Some<BuilderData>,
      BuilderHandler
    >,
    handler: AddBuilderHandler,
  ) {
    return new ChatInputSubcommandGroupHandlerContextWithSubcommandHandlerBuilder(
      {
        builder: this.builder.addSubcommandHandler(handler),
      },
    );
  }

  build<
    BuilderData extends SlashCommandSubcommandGroupBuilder,
    BuilderHandler extends AnySubcommandHandler,
  >(
    this: ChatInputSubcommandGroupHandlerContextWithSubcommandHandlerBuilder<
      Option.Some<BuilderData>,
      BuilderHandler
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
