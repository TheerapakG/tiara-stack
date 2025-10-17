import { Data, Function, HashMap, Option, Struct, Types } from "effect";
import {
  type BaseHandlerT,
  type Handler,
  type HandlerData,
  type HandlerContext as HandlerEffectContext,
  type HandlerDataKey,
} from "../type";
import {
  data,
  type HandlerContext,
  type HandlerOrUndefined,
  type PartialHandlerContextHandlerT,
} from "./context";

type HandlerContextMap<HandlerT extends BaseHandlerT, R> = HashMap.HashMap<
  HandlerDataKey<HandlerT, HandlerData<HandlerT>>,
  HandlerContext<
    HandlerT,
    HandlerData<HandlerT>,
    Handler<HandlerT, unknown, unknown, R>
  >
>;

const HandlerContextGroupTypeId = Symbol(
  "Typhoon/Handler/HandlerContextGroupTypeId",
);
export type HandlerContextGroupTypeId = typeof HandlerContextGroupTypeId;

interface Variance<in out HandlerT extends BaseHandlerT, out R> {
  [HandlerContextGroupTypeId]: {
    _HandlerT: Types.Invariant<HandlerT>;
    _R: Types.Covariant<R>;
  };
}

const handlerContextGroupVariance: <
  HandlerT extends BaseHandlerT,
  R,
>() => Variance<HandlerT, R>[HandlerContextGroupTypeId] = () => ({
  _HandlerT: Function.identity,
  _R: Function.identity,
});

export class HandlerContextGroup<HandlerT extends BaseHandlerT, R = never>
  extends Data.TaggedClass("HandlerContextGroup")<{
    map: HandlerContextMap<HandlerT, R>;
    dataKeyTransformer: (
      data: HandlerData<HandlerT>,
    ) => HandlerDataKey<HandlerT, HandlerData<HandlerT>>;
  }>
  implements Variance<HandlerT, R>
{
  [HandlerContextGroupTypeId] = handlerContextGroupVariance<HandlerT, R>();
}

export type HandlerContextGroupHandlerT<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  G extends HandlerContextGroup<any, any>,
> = Types.Invariant.Type<G[HandlerContextGroupTypeId]["_HandlerT"]>;
export type HandlerContextGroupContext<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  G extends HandlerContextGroup<any, any>,
> = Types.Covariant.Type<G[HandlerContextGroupTypeId]["_R"]>;

export const empty = <HandlerT extends BaseHandlerT, R = never>(
  dataKeyTransformer: (
    data: HandlerData<HandlerT>,
  ) => HandlerDataKey<HandlerT, HandlerData<HandlerT>>,
) =>
  new HandlerContextGroup<HandlerT, R>({
    map: HashMap.empty(),
    dataKeyTransformer,
  });

export const add =
  <
    const Config extends HandlerContext<any>,
    HandlerT extends
      PartialHandlerContextHandlerT<Config> = PartialHandlerContextHandlerT<Config>,
  >(
    handlerContextConfig: Config,
  ) =>
  <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const G extends HandlerContextGroup<HandlerT, any>,
  >(
    handlerContextGroup: G,
  ) =>
    new HandlerContextGroup<
      HandlerT,
      HandlerOrUndefined<Config> extends infer H extends Handler<HandlerT>
        ? HandlerContextGroupContext<G> | HandlerEffectContext<HandlerT, H>
        : never
    >(
      Struct.evolve(handlerContextGroup, {
        map: (map) =>
          HashMap.set(
            map,
            handlerContextGroup.dataKeyTransformer(data(handlerContextConfig)),
            handlerContextConfig,
          ),
      }),
    );

export const addGroup =
  <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const OtherG extends HandlerContextGroup<any, any>,
    HandlerT extends
      HandlerContextGroupHandlerT<OtherG> = HandlerContextGroupHandlerT<OtherG>,
  >(
    otherGroup: OtherG,
  ) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <const ThisG extends HandlerContextGroup<HandlerT, any>>(thisGroup: ThisG) =>
    new HandlerContextGroup<
      HandlerT,
      HandlerContextGroupContext<ThisG> | HandlerContextGroupContext<OtherG>
    >(
      Struct.evolve(thisGroup, {
        map: (map) => HashMap.union(map, otherGroup.map),
      }),
    );

export const getHandlerContext =
  <HandlerT extends BaseHandlerT>(
    key: HandlerDataKey<HandlerT, HandlerData<HandlerT>>,
  ) =>
  <R>(
    handlerContextGroup: HandlerContextGroup<HandlerT, R>,
  ): Option.Option<
    HandlerContext<
      HandlerT,
      HandlerData<HandlerT>,
      Handler<HandlerT, unknown, unknown, R>
    >
  > =>
    HashMap.get(handlerContextGroup.map, key);
