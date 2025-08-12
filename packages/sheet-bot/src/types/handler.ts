import {
  ChatInputCommandInteraction,
  SharedSlashCommand,
  SharedSlashCommandSubcommands,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
  SlashCommandSubcommandGroupBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";
import { Data, Effect, HashMap, Option, pipe } from "effect";
import {
  HandlerVariantData,
  HandlerVariantInteraction,
  HandlerVariantKey,
} from "./handlerVariant";
import { InteractionContext } from "./interactionContext";

type Constrain<T, C> = T extends infer U extends C ? U : never;

export type InteractionHandler<A = never, E = never, R = never> = Effect.Effect<
  A,
  E,
  R
>;
export type AnyInteractionHandler<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  A = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  E = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  R = any,
> = InteractionHandler<A, E, R>;

type InteractionHandlerSuccess<H extends AnyInteractionHandler> =
  H extends InteractionHandler<infer A, unknown, unknown> ? A : never;

type InteractionHandlerError<H extends AnyInteractionHandler> =
  H extends InteractionHandler<unknown, infer E, unknown> ? E : never;

type InteractionHandlerRequirement<H extends AnyInteractionHandler> =
  H extends InteractionHandler<unknown, unknown, infer R> ? R : never;

export type VariantInteractionHandler<
  Variant extends HandlerVariantKey,
  A = never,
  E = never,
  R = never,
> = InteractionHandler<
  A,
  E,
  R | InteractionContext<HandlerVariantInteraction<Variant>>
>;

export type InteractionHandlerContextObject<
  Data = unknown,
  A = never,
  E = never,
  R = never,
> = {
  data: Data;
  handler: InteractionHandler<A, E, R>;
};

export class InteractionHandlerContext<
  Data = unknown,
  A = never,
  E = never,
  R = never,
> extends Data.TaggedClass("InteractionHandlerContext")<
  InteractionHandlerContextObject<Data, A, E, R>
> {}

export type VariantInteractionHandlerContext<
  Variant extends HandlerVariantKey,
  A = never,
  E = never,
  R = never,
> = InteractionHandlerContext<
  HandlerVariantData<Variant>,
  A,
  E,
  R | InteractionContext<HandlerVariantInteraction<Variant>>
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
  static empty<Data, Handler extends AnyInteractionHandler>() {
    return new InteractionHandlerContextBuilder({
      _data: Option.none() as Option.None<Data>,
      _handler: Option.none() as Option.None<Handler>,
    });
  }

  static emptyVariant<Variant extends HandlerVariantKey>() {
    return InteractionHandlerContextBuilder.empty<
      HandlerVariantData<Variant>,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      VariantInteractionHandler<Variant, any, any, any>
    >();
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
    return new InteractionHandlerContext<
      InnerData,
      InteractionHandlerSuccess<InnerHandler>,
      InteractionHandlerError<InnerHandler>,
      InteractionHandlerRequirement<InnerHandler>
    >({
      data: this._data.value,
      handler: this._handler.value,
    });
  }
}

export const buttonInteractionHandlerContextBuilder = () =>
  InteractionHandlerContextBuilder.emptyVariant<"button">();

export const chatInputCommandHandlerContextBuilder = () =>
  InteractionHandlerContextBuilder.emptyVariant<"chatInput">();

export const chatInputSubcommandGroupHandlerContextBuilder = () =>
  InteractionHandlerContextBuilder.emptyVariant<"chatInputSubcommandGroup">();

export const chatInputSubcommandHandlerContextBuilder = () =>
  InteractionHandlerContextBuilder.emptyVariant<"chatInputSubcommand">();

export type InteractionHandlerMapObject<
  Data = unknown,
  A = never,
  E = never,
  R = never,
> = {
  map: HashMap.HashMap<string, InteractionHandlerContext<Data, A, E, R>>;
  keyGetter: (data: Data) => string;
};

export class InteractionHandlerMap<
  Data = unknown,
  A = never,
  E = never,
  R = never,
> extends Data.TaggedClass("InteractionHandlerMap")<
  InteractionHandlerMapObject<Data, A, E, R>
> {
  static empty<Data = unknown, A = never, E = never, R = never>(
    keyGetter: (data: Data) => string,
  ) {
    return new InteractionHandlerMap<Data, A, E, R>({
      map: HashMap.empty(),
      keyGetter,
    });
  }

  static emptyVariant<
    Variant extends HandlerVariantKey,
    A = never,
    E = never,
    R = never,
  >(keyGetter: (data: HandlerVariantData<Variant>) => string) {
    return InteractionHandlerMap.empty<HandlerVariantData<Variant>, A, E, R>(
      keyGetter,
    );
  }

  static add<Data1 extends Data2, Data2, A1 = never, E1 = never, R1 = never>(
    context: InteractionHandlerContext<Data1, A1, E1, R1>,
  ) {
    return <A2 = never, E2 = never, R2 = never>(
      map: InteractionHandlerMap<Data2, A2, E2, R2>,
    ) =>
      new InteractionHandlerMap({
        map: HashMap.set(
          map.map as HashMap.HashMap<
            string,
            InteractionHandlerContext<Data2, A1 | A2, E1 | E2, R1 | R2>
          >,
          map.keyGetter(context.data),
          context,
        ),
        keyGetter: map.keyGetter,
      });
  }

  static get(key: string) {
    return <Data, A, E, R>(map: InteractionHandlerMap<Data, A, E, R>) =>
      HashMap.get(map.map, key);
  }

  static union<Data1 extends Data2, Data2, A1 = never, E1 = never, R1 = never>(
    map: InteractionHandlerMap<Data1, A1, E1, R1>,
  ) {
    return <A2 = never, E2 = never, R2 = never>(
      other: InteractionHandlerMap<Data2, A2, E2, R2>,
    ) =>
      new InteractionHandlerMap({
        map: HashMap.union(
          map.map as HashMap.HashMap<
            string,
            InteractionHandlerContext<Data2, A1 | A2, E1 | E2, R1 | R2>
          >,
          other.map as HashMap.HashMap<
            string,
            InteractionHandlerContext<Data2, A1 | A2, E1 | E2, R1 | R2>
          >,
        ),
        keyGetter: other.keyGetter,
      });
  }

  static values<Data, A, E, R>(map: InteractionHandlerMap<Data, A, E, R>) {
    return HashMap.values(map.map);
  }
}

export type VariantInteractionHandlerMap<
  Variant extends HandlerVariantKey,
  A = never,
  E = never,
  R = never,
> = InteractionHandlerMap<
  HandlerVariantData<Variant>,
  A,
  E,
  R | InteractionContext<HandlerVariantInteraction<Variant>>
>;

export const buttonInteractionHandlerMap = <
  A = never,
  E = never,
  R = never,
>() =>
  InteractionHandlerMap.emptyVariant<"button", A, E, R>(
    (data) => data.customId,
  );

export const chatInputCommandHandlerMap = <A = never, E = never, R = never>() =>
  InteractionHandlerMap.emptyVariant<"chatInput", A, E, R>((data) => data.name);

export const chatInputSubcommandGroupHandlerMap = <
  A = never,
  E = never,
  R = never,
>() =>
  InteractionHandlerMap.emptyVariant<"chatInputSubcommandGroup", A, E, R>(
    (data) => data.name,
  );

export const chatInputSubcommandHandlerMap = <
  A = never,
  E = never,
  R = never,
>() =>
  InteractionHandlerMap.emptyVariant<"chatInputSubcommand", A, E, R>(
    (data) => data.name,
  );

export type SubcommandHandlerObject<A = never, E = never, R = never> = {
  subcommandGroupHandlerMap: VariantInteractionHandlerMap<
    "chatInputSubcommandGroup",
    A,
    E,
    R
  >;
  subcommandHandlerMap: VariantInteractionHandlerMap<
    "chatInputSubcommand",
    A,
    E,
    R
  >;
};

export class SubcommandHandler<
  A = never,
  E = never,
  R = never,
> extends Data.TaggedClass("SubcommandHandler")<
  SubcommandHandlerObject<A, E, R>
> {
  static empty<A = never, E = never, R = never>() {
    return new SubcommandHandler({
      subcommandGroupHandlerMap: chatInputSubcommandGroupHandlerMap<A, E, R>(),
      subcommandHandlerMap: chatInputSubcommandHandlerMap<A, E, R>(),
    });
  }

  static addSubcommandGroupHandler<A = never, E = never, R = never>(
    handler: VariantInteractionHandlerContext<
      "chatInputSubcommandGroup",
      A,
      E,
      R
    >,
  ) {
    return <MA = never, ME = never, MR = never>(
      map: SubcommandHandler<MA, ME, MR>,
    ) =>
      new SubcommandHandler({
        subcommandGroupHandlerMap: pipe(
          map.subcommandGroupHandlerMap,
          InteractionHandlerMap.add(handler),
        ),
        subcommandHandlerMap: map.subcommandHandlerMap,
      });
  }

  static addSubcommandGroupHandlerMap<A = never, E = never, R = never>(
    handlerMap: VariantInteractionHandlerMap<
      "chatInputSubcommandGroup",
      A,
      E,
      R
    >,
  ) {
    return <MA = never, ME = never, MR = never>(
      map: SubcommandHandler<MA, ME, MR>,
    ) =>
      new SubcommandHandler({
        subcommandGroupHandlerMap: pipe(
          map.subcommandGroupHandlerMap,
          InteractionHandlerMap.union(handlerMap),
        ),
        subcommandHandlerMap: map.subcommandHandlerMap,
      });
  }

  static addSubcommandHandler<A = never, E = never, R = never>(
    handler: VariantInteractionHandlerContext<"chatInputSubcommand", A, E, R>,
  ) {
    return <MA = never, ME = never, MR = never>(
      map: SubcommandHandler<MA, ME, MR>,
    ) =>
      new SubcommandHandler({
        subcommandGroupHandlerMap: map.subcommandGroupHandlerMap,
        subcommandHandlerMap: pipe(
          map.subcommandHandlerMap,
          InteractionHandlerMap.add(handler),
        ),
      });
  }

  static addSubcommandHandlerMap<A = never, E = never, R = never>(
    handlerMap: InteractionHandlerMap<SlashCommandSubcommandBuilder, A, E, R>,
  ) {
    return <MA = never, ME = never, MR = never>(
      map: SubcommandHandler<MA, ME, MR>,
    ) =>
      new SubcommandHandler({
        subcommandGroupHandlerMap: map.subcommandGroupHandlerMap,
        subcommandHandlerMap: pipe(
          map.subcommandHandlerMap,
          InteractionHandlerMap.union(handlerMap),
        ),
      });
  }

  static handler<A = never, E = never, R = never>(
    handler: SubcommandHandler<A, E, R>,
  ) {
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
          Option.getOrElse<InteractionHandler<void, never, never>>(
            () => Effect.void,
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
  A = never,
  E = never,
  R = never,
> = {
  _data: Data;
  _handler: SubcommandHandler<A, E, R>;
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
  A = never,
  E = never,
  R = never,
> extends Data.TaggedClass(
  "InteractionHandlerContextWithSubcommandHandlerBuilder",
)<InteractionHandlerContextWithSubcommandHandlerBuilderData<Data, A, E, R>> {
  static empty<
    BuilderData extends
      | SlashCommandBuilder
      | SlashCommandSubcommandsOnlyBuilder
      | SlashCommandSubcommandGroupBuilder,
    A = never,
    E = never,
    R = never,
  >() {
    return new InteractionHandlerContextWithSubcommandHandlerBuilder({
      _data: Option.none() as Option.None<BuilderData>,
      _handler: SubcommandHandler.empty<A, E, R>(),
    });
  }

  data<
    BuilderData extends
      | SlashCommandBuilder
      | SlashCommandSubcommandsOnlyBuilder
      | SlashCommandSubcommandGroupBuilder,
    A,
    E,
    R,
  >(
    this: InteractionHandlerContextWithSubcommandHandlerBuilder<
      Option.None<
        | SlashCommandBuilder
        | SlashCommandSubcommandsOnlyBuilder
        | SlashCommandSubcommandGroupBuilder
      >,
      A,
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
    A,
    E,
    R,
    MA,
    ME,
    MR,
  >(
    this: InteractionHandlerContextWithSubcommandHandlerBuilder<
      Option.Some<BuilderData>,
      MA,
      ME,
      MR
    >,
    handler: VariantInteractionHandlerContext<"chatInputSubcommand", A, E, R>,
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
    A,
    E,
    R,
    MA,
    ME,
    MR,
  >(
    this: InteractionHandlerContextWithSubcommandHandlerBuilder<
      Option.Some<BuilderData>,
      MA,
      ME,
      MR
    >,
    handler: VariantInteractionHandlerContext<
      "chatInputSubcommandGroup",
      A,
      E,
      R
    >,
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
      A,
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
  A = never,
  E = never,
  R = never,
> extends Data.TaggedClass(
  "ChatInputCommandHandlerContextWithSubcommandHandlerBuilder",
)<{
  builder: InteractionHandlerContextWithSubcommandHandlerBuilder<Data, A, E, R>;
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
    A,
    E,
    R,
  >(
    this: ChatInputCommandHandlerContextWithSubcommandHandlerBuilder<
      Option.None<SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder>,
      A,
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
    A,
    E,
    R,
    MA,
    ME,
    MR,
  >(
    this: ChatInputCommandHandlerContextWithSubcommandHandlerBuilder<
      Option.Some<BuilderData>,
      MA,
      ME,
      MR
    >,
    handler: VariantInteractionHandlerContext<"chatInputSubcommand", A, E, R>,
  ) {
    return new ChatInputCommandHandlerContextWithSubcommandHandlerBuilder({
      builder: this.builder.addSubcommandHandler(handler),
    });
  }

  addSubcommandGroupHandler<
    BuilderData extends
      | SlashCommandBuilder
      | SlashCommandSubcommandsOnlyBuilder,
    A,
    E,
    R,
    MA,
    ME,
    MR,
  >(
    this: ChatInputCommandHandlerContextWithSubcommandHandlerBuilder<
      Option.Some<BuilderData>,
      MA,
      ME,
      MR
    >,
    handler: VariantInteractionHandlerContext<
      "chatInputSubcommandGroup",
      A,
      E,
      R
    >,
  ) {
    return new ChatInputCommandHandlerContextWithSubcommandHandlerBuilder({
      builder: this.builder.addSubcommandGroupHandler(handler),
    });
  }

  build<
    BuilderData extends
      | SlashCommandBuilder
      | SlashCommandSubcommandsOnlyBuilder,
    A,
    E,
    R,
  >(
    this: ChatInputCommandHandlerContextWithSubcommandHandlerBuilder<
      Option.Some<BuilderData>,
      A,
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
  A = never,
  E = never,
  R = never,
> extends Data.TaggedClass(
  "ChatInputSubcommandGroupHandlerContextWithSubcommandHandlerBuilder",
)<{
  builder: InteractionHandlerContextWithSubcommandHandlerBuilder<Data, A, E, R>;
}> {
  static empty() {
    return new ChatInputSubcommandGroupHandlerContextWithSubcommandHandlerBuilder(
      {
        builder:
          InteractionHandlerContextWithSubcommandHandlerBuilder.empty<SlashCommandSubcommandGroupBuilder>(),
      },
    );
  }

  data<BuilderData extends SlashCommandSubcommandGroupBuilder, A, E, R>(
    this: ChatInputSubcommandGroupHandlerContextWithSubcommandHandlerBuilder<
      Option.None<SlashCommandSubcommandGroupBuilder>,
      A,
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
    A,
    E,
    R,
    MA,
    ME,
    MR,
  >(
    this: ChatInputSubcommandGroupHandlerContextWithSubcommandHandlerBuilder<
      Option.Some<BuilderData>,
      MA,
      ME,
      MR
    >,
    handler: VariantInteractionHandlerContext<"chatInputSubcommand", A, E, R>,
  ) {
    return new ChatInputSubcommandGroupHandlerContextWithSubcommandHandlerBuilder(
      {
        builder: this.builder.addSubcommandHandler(handler),
      },
    );
  }

  build<BuilderData extends SlashCommandSubcommandGroupBuilder, A, E, R>(
    this: ChatInputSubcommandGroupHandlerContextWithSubcommandHandlerBuilder<
      Option.Some<BuilderData>,
      A,
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
