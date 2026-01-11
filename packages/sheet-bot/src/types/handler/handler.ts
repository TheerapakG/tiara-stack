import { Data, Effect, HashMap, Option } from "effect";

type Constrain<T, C> = T extends infer U extends C ? U : never;

export type InteractionHandler<A = never, E = never, R = never> = Effect.Effect<A, E, R>;
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

export type InteractionHandlerContextObject<Data = unknown, A = never, E = never, R = never> = {
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

export type InteractionHandlerContextBuilderObject<
  Data extends Option.Option<unknown> = Option.None<unknown>,
  Handler extends Option.Option<AnyInteractionHandler> = Option.None<AnyInteractionHandler>,
> = {
  _data: Data;
  _handler: Handler;
};

export class InteractionHandlerContextBuilder<
  Data extends Option.Option<unknown> = Option.None<unknown>,
  Handler extends Option.Option<AnyInteractionHandler> = Option.None<AnyInteractionHandler>,
> extends Data.TaggedClass("InteractionHandlerContextBuilder")<
  InteractionHandlerContextBuilderObject<Data, Handler>
> {
  static empty = <Data, Handler extends AnyInteractionHandler>() => {
    return new InteractionHandlerContextBuilder({
      _data: Option.none() as Option.None<Data>,
      _handler: Option.none() as Option.None<Handler>,
    });
  };

  data<BuilderData extends Option.Option.Value<Data>>(
    this: InteractionHandlerContextBuilder<Option.None<Option.Option.Value<Data>>, Handler>,
    data: BuilderData,
  ) {
    return new InteractionHandlerContextBuilder({
      _data: Option.some(data) as Option.Some<Option.Option.Value<Data>>,
      _handler: this._handler,
    });
  }

  handler<BuilderHandler extends Constrain<Option.Option.Value<Handler>, AnyInteractionHandler>>(
    this: InteractionHandlerContextBuilder<
      Data,
      Option.None<Constrain<Option.Option.Value<Handler>, AnyInteractionHandler>>
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
    InnerHandler extends Constrain<Option.Option.Value<Handler>, AnyInteractionHandler> = Constrain<
      Option.Option.Value<Handler>,
      AnyInteractionHandler
    >,
  >(this: InteractionHandlerContextBuilder<Option.Some<InnerData>, Option.Some<InnerHandler>>) {
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

export type InteractionHandlerMapObject<Data = unknown, A = never, E = never, R = never> = {
  map: HashMap.HashMap<string, InteractionHandlerContext<Data, A, E, R>>;
  keyGetter: (data: Data) => string;
};

export class InteractionHandlerMap<
  Data = unknown,
  A = never,
  E = never,
  R = never,
> extends Data.TaggedClass("InteractionHandlerMap")<InteractionHandlerMapObject<Data, A, E, R>> {
  static empty = <Data = unknown, A = never, E = never, R = never>(
    keyGetter: (data: Data) => string,
  ) => {
    return new InteractionHandlerMap<Data, A, E, R>({
      map: HashMap.empty(),
      keyGetter,
    });
  };

  static add = <Data1 extends Data2, Data2, A1 = never, E1 = never, R1 = never>(
    context: InteractionHandlerContext<Data1, A1, E1, R1>,
  ) => {
    return <A2 = never, E2 = never, R2 = never>(map: InteractionHandlerMap<Data2, A2, E2, R2>) =>
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
  };

  static get = (key: string) => {
    return <Data, A, E, R>(map: InteractionHandlerMap<Data, A, E, R>) => HashMap.get(map.map, key);
  };

  static union = <Data1 extends Data2, Data2, A1 = never, E1 = never, R1 = never>(
    map: InteractionHandlerMap<Data1, A1, E1, R1>,
  ) => {
    return <A2 = never, E2 = never, R2 = never>(other: InteractionHandlerMap<Data2, A2, E2, R2>) =>
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
  };

  static keys = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map: InteractionHandlerMap<any, unknown, unknown, unknown>,
  ) => {
    return HashMap.keys(map.map);
  };

  static values = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map: InteractionHandlerMap<any, unknown, unknown, unknown>,
  ) => {
    return HashMap.values(map.map);
  };
}
