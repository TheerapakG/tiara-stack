import { Data, Function, Option, Record, Struct, Types } from "effect";
import {
  type BaseHandlerT,
  type Handler,
  type HandlerData,
  type HandlerContext as HandlerEffectContext,
  type HandlerDataKey,
} from "../type";
import {
  type DataOrUndefined,
  data,
  type HandlerContext,
  type HandlerOrUndefined,
  type PartialHandlerContextHandlerT,
} from "./context";
import {
  type BaseHandlerDataGroupRecord,
  type AddHandlerDataGroupRecord,
  type AddHandlerDataGroupGroupRecord,
} from "../data/group";

type HandlerContextGroupRecord<HandlerT extends BaseHandlerT, R> = Record<
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

interface Variance<
  in out HandlerT extends BaseHandlerT,
  out R,
  in out HData extends BaseHandlerDataGroupRecord<HandlerT>,
> {
  [HandlerContextGroupTypeId]: {
    _HandlerT: Types.Invariant<HandlerT>;
    _R: Types.Covariant<R>;
    _HData: Types.Invariant<HData>;
  };
}

const handlerContextGroupVariance: <
  HandlerT extends BaseHandlerT,
  R,
  HData extends BaseHandlerDataGroupRecord<HandlerT>,
>() => Variance<HandlerT, R, HData>[HandlerContextGroupTypeId] = () => ({
  _HandlerT: Function.identity,
  _R: Function.identity,
  _HData: Function.identity,
});

export class HandlerContextGroup<
    HandlerT extends BaseHandlerT,
    R,
    HData extends BaseHandlerDataGroupRecord<HandlerT>,
  >
  extends Data.TaggedClass("HandlerContextGroup")<{
    record: HandlerContextGroupRecord<HandlerT, R>;
    dataKeyTransformer: (
      data: HandlerData<HandlerT>,
    ) => HandlerDataKey<HandlerT, HandlerData<HandlerT>>;
  }>
  implements Variance<HandlerT, R, HData>
{
  [HandlerContextGroupTypeId] = handlerContextGroupVariance<
    HandlerT,
    R,
    HData
  >();
}

export type HandlerContextGroupHandlerT<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  G extends HandlerContextGroup<any, any, any>,
> =
  Types.Invariant.Type<
    G[HandlerContextGroupTypeId]["_HandlerT"]
  > extends infer HT extends BaseHandlerT
    ? HT
    : never;
export type HandlerContextGroupContext<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  G extends HandlerContextGroup<any, any, any>,
> =
  Types.Covariant.Type<G[HandlerContextGroupTypeId]["_R"]> extends infer R
    ? R
    : never;
export type HandlerContextGroupHData<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  G extends HandlerContextGroup<any, any, any>,
> =
  Types.Invariant.Type<
    G[HandlerContextGroupTypeId]["_HData"]
  > extends infer HData extends BaseHandlerDataGroupRecord<
    HandlerContextGroupHandlerT<G>
  >
    ? HData
    : never;

export const empty = <HandlerT extends BaseHandlerT, R = never>(
  dataKeyTransformer: (
    data: HandlerData<HandlerT>,
  ) => HandlerDataKey<HandlerT, HandlerData<HandlerT>>,
) =>
  new HandlerContextGroup<HandlerT, R, {}>({
    record: {},
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
    const G extends HandlerContextGroup<
      HandlerT,
      any,
      BaseHandlerDataGroupRecord<HandlerT>
    >,
  >(
    handlerContextGroup: G,
  ) =>
    new HandlerContextGroup<
      HandlerT,
      | HandlerContextGroupContext<G>
      | HandlerEffectContext<HandlerT, HandlerOrUndefined<Config>>,
      AddHandlerDataGroupRecord<
        HandlerT,
        HandlerContextGroupHData<G> extends infer HData extends
          BaseHandlerDataGroupRecord<HandlerT>
          ? HData
          : never,
        DataOrUndefined<Config>
      >
    >(
      Struct.evolve(handlerContextGroup, {
        record: (record) =>
          Record.set(
            record,
            handlerContextGroup.dataKeyTransformer(data(handlerContextConfig)),
            handlerContextConfig,
          ),
      }),
    );

export const addGroup =
  <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const OtherG extends HandlerContextGroup<any, any, any>,
    HandlerT extends
      HandlerContextGroupHandlerT<OtherG> = HandlerContextGroupHandlerT<OtherG>,
  >(
    otherGroup: OtherG,
  ) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <const ThisG extends HandlerContextGroup<HandlerT, any, any>>(
    thisGroup: ThisG,
  ) =>
    new HandlerContextGroup<
      HandlerT,
      HandlerContextGroupContext<ThisG> | HandlerContextGroupContext<OtherG>,
      AddHandlerDataGroupGroupRecord<
        HandlerT,
        HandlerContextGroupHData<ThisG> extends infer HData extends
          BaseHandlerDataGroupRecord<HandlerT>
          ? HData
          : never,
        HandlerContextGroupHData<OtherG> extends infer HData extends
          BaseHandlerDataGroupRecord<HandlerT>
          ? HData
          : never
      >
    >(
      Struct.evolve(thisGroup, {
        record: (record) =>
          Record.union(
            record,
            otherGroup.record,
            (context) => context,
          ) as HandlerContextGroupRecord<
            HandlerT,
            | HandlerContextGroupContext<ThisG>
            | HandlerContextGroupContext<OtherG>
          >,
      }),
    );

export const getHandlerContext =
  <HandlerT extends BaseHandlerT>(
    key: HandlerDataKey<HandlerT, HandlerData<HandlerT>>,
  ) =>
  <R>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handlerContextGroup: HandlerContextGroup<HandlerT, R, any>,
  ): Option.Option<
    HandlerContext<
      HandlerT,
      HandlerData<HandlerT>,
      Handler<HandlerT, unknown, unknown, R>
    >
  > =>
    Record.get(handlerContextGroup.record, key);
