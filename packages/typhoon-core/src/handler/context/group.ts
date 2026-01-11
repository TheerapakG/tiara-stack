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
  HandlerContext<HandlerT, HandlerData<HandlerT>, Handler<HandlerT, unknown, unknown, R>>
>;

const HandlerContextGroupTypeId = Symbol("Typhoon/Handler/HandlerContextGroupTypeId");
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
  [HandlerContextGroupTypeId] = handlerContextGroupVariance<HandlerT, R, HData>();
}

export type HandlerContextGroupHandlerT<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  G extends HandlerContextGroup<any, any, any>,
> = [G] extends [HandlerContextGroup<infer HandlerT, any, any>] ? HandlerT : never;
export type HandlerContextGroupContext<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  G extends HandlerContextGroup<any, any, any>,
> = [G] extends [HandlerContextGroup<any, infer R, any>] ? R : never;
export type HandlerContextGroupHData<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  G extends HandlerContextGroup<any, any, any>,
> = [G] extends [HandlerContextGroup<any, any, infer HData>] ? HData : never;

export type InferHandlerContextGroup<
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  G extends HandlerContextGroup<any, any, any>,
> = HandlerContextGroup<
  HandlerContextGroupHandlerT<G>,
  HandlerContextGroupContext<G>,
  HandlerContextGroupHData<G>
>;

export const empty = <HandlerT extends BaseHandlerT, R = never>(
  dataKeyTransformer: (
    data: HandlerData<HandlerT>,
  ) => HandlerDataKey<HandlerT, HandlerData<HandlerT>>,
) =>
  new HandlerContextGroup<HandlerT, R, {}>({
    record: {},
    dataKeyTransformer,
  });

export const add = Function.dual<
  <const Config extends HandlerContext<any>>(
    handlerContextConfig: Config,
  ) => <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const G extends HandlerContextGroup<
      PartialHandlerContextHandlerT<Config>,
      any,
      BaseHandlerDataGroupRecord<PartialHandlerContextHandlerT<Config>>
    >,
  >(
    handlerContextGroup: G,
  ) => HandlerContextGroup<
    PartialHandlerContextHandlerT<Config>,
    | HandlerContextGroupContext<G>
    | HandlerEffectContext<PartialHandlerContextHandlerT<Config>, HandlerOrUndefined<Config>>,
    AddHandlerDataGroupRecord<
      PartialHandlerContextHandlerT<Config>,
      HandlerContextGroupHData<G> extends infer HData extends BaseHandlerDataGroupRecord<
        PartialHandlerContextHandlerT<Config>
      >
        ? HData
        : never,
      DataOrUndefined<Config>
    >
  >,
  <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const G extends HandlerContextGroup<any, any, any>,
    const Config extends HandlerContext<HandlerContextGroupHandlerT<G>>,
  >(
    handlerContextGroup: G,
    handlerContextConfig: Config,
  ) => HandlerContextGroup<
    HandlerContextGroupHandlerT<G>,
    | HandlerContextGroupContext<G>
    | HandlerEffectContext<HandlerContextGroupHandlerT<G>, HandlerOrUndefined<Config>>,
    AddHandlerDataGroupRecord<
      HandlerContextGroupHandlerT<G>,
      HandlerContextGroupHData<G> extends infer HData extends BaseHandlerDataGroupRecord<
        PartialHandlerContextHandlerT<Config>
      >
        ? HData
        : never,
      DataOrUndefined<Config>
    >
  >
>(
  2,
  <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const G extends HandlerContextGroup<any, any, any>,
    const Config extends HandlerContext<HandlerContextGroupHandlerT<G>>,
  >(
    handlerContextGroup: G,
    handlerContextConfig: Config,
  ) =>
    new HandlerContextGroup<
      HandlerContextGroupHandlerT<G>,
      | HandlerContextGroupContext<G>
      | HandlerEffectContext<HandlerContextGroupHandlerT<G>, HandlerOrUndefined<Config>>,
      AddHandlerDataGroupRecord<
        HandlerContextGroupHandlerT<G>,
        HandlerContextGroupHData<G> extends infer HData extends BaseHandlerDataGroupRecord<
          HandlerContextGroupHandlerT<G>
        >
          ? HData
          : never,
        DataOrUndefined<Config>
      >
    >(
      Struct.evolve(handlerContextGroup as InferHandlerContextGroup<G>, {
        record: (record) =>
          Record.set(
            record,
            handlerContextGroup.dataKeyTransformer(data(handlerContextConfig)),
            handlerContextConfig,
          ),
      }),
    ),
);

export const addGroup = Function.dual<
  <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const OtherG extends HandlerContextGroup<any, any, any>,
  >(
    otherGroup: OtherG,
  ) => <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ThisG extends HandlerContextGroup<HandlerContextGroupHandlerT<OtherG>, any, any>,
  >(
    thisGroup: ThisG,
  ) => HandlerContextGroup<
    HandlerContextGroupHandlerT<ThisG>,
    HandlerContextGroupContext<ThisG> | HandlerContextGroupContext<OtherG>,
    AddHandlerDataGroupGroupRecord<
      HandlerContextGroupHandlerT<ThisG>,
      HandlerContextGroupHData<ThisG> extends infer HData extends BaseHandlerDataGroupRecord<
        HandlerContextGroupHandlerT<ThisG>
      >
        ? HData
        : never,
      HandlerContextGroupHData<OtherG> extends infer HData extends BaseHandlerDataGroupRecord<
        HandlerContextGroupHandlerT<ThisG>
      >
        ? HData
        : never
    >
  >,
  <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ThisG extends HandlerContextGroup<any, any, any>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const OtherG extends HandlerContextGroup<HandlerContextGroupHandlerT<ThisG>, any, any>,
  >(
    thisGroup: ThisG,
    otherGroup: OtherG,
  ) => HandlerContextGroup<
    HandlerContextGroupHandlerT<ThisG>,
    HandlerContextGroupContext<ThisG> | HandlerContextGroupContext<OtherG>,
    AddHandlerDataGroupGroupRecord<
      HandlerContextGroupHandlerT<ThisG>,
      HandlerContextGroupHData<ThisG> extends infer HData extends BaseHandlerDataGroupRecord<
        HandlerContextGroupHandlerT<ThisG>
      >
        ? HData
        : never,
      HandlerContextGroupHData<OtherG> extends infer HData extends BaseHandlerDataGroupRecord<
        HandlerContextGroupHandlerT<ThisG>
      >
        ? HData
        : never
    >
  >
>(
  2,
  <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ThisG extends HandlerContextGroup<any, any, any>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const OtherG extends HandlerContextGroup<HandlerContextGroupHandlerT<ThisG>, any, any>,
  >(
    thisGroup: ThisG,
    otherGroup: OtherG,
  ) =>
    new HandlerContextGroup<
      HandlerContextGroupHandlerT<ThisG>,
      HandlerContextGroupContext<ThisG> | HandlerContextGroupContext<OtherG>,
      AddHandlerDataGroupGroupRecord<
        HandlerContextGroupHandlerT<ThisG>,
        HandlerContextGroupHData<ThisG> extends infer HData extends BaseHandlerDataGroupRecord<
          HandlerContextGroupHandlerT<ThisG>
        >
          ? HData
          : never,
        HandlerContextGroupHData<OtherG> extends infer HData extends BaseHandlerDataGroupRecord<
          HandlerContextGroupHandlerT<ThisG>
        >
          ? HData
          : never
      >
    >(
      Struct.evolve(thisGroup as InferHandlerContextGroup<ThisG>, {
        record: (record) => Record.union(record, otherGroup.record, (context) => context),
      }),
    ),
);

export const getHandlerContext = Function.dual<
  <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    G extends HandlerContextGroup<any, any, any>,
  >(
    key: HandlerDataKey<
      HandlerContextGroupHandlerT<G>,
      HandlerData<HandlerContextGroupHandlerT<G>>
    >,
  ) => (
    handlerContextGroup: G,
  ) => Option.Option<
    HandlerContext<
      HandlerContextGroupHandlerT<G>,
      HandlerData<HandlerContextGroupHandlerT<G>>,
      Handler<HandlerContextGroupHandlerT<G>, unknown, unknown, HandlerContextGroupContext<G>>
    >
  >,
  <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    G extends HandlerContextGroup<any, any, any>,
  >(
    handlerContextGroup: G,
    key: HandlerDataKey<
      HandlerContextGroupHandlerT<G>,
      HandlerData<HandlerContextGroupHandlerT<G>>
    >,
  ) => Option.Option<
    HandlerContext<
      HandlerContextGroupHandlerT<G>,
      HandlerData<HandlerContextGroupHandlerT<G>>,
      Handler<HandlerContextGroupHandlerT<G>, unknown, unknown, HandlerContextGroupContext<G>>
    >
  >
>(
  2,
  <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    G extends HandlerContextGroup<any, any, any>,
  >(
    handlerContextGroup: G,
    key: HandlerDataKey<
      HandlerContextGroupHandlerT<G>,
      HandlerData<HandlerContextGroupHandlerT<G>>
    >,
  ): Option.Option<
    HandlerContext<
      HandlerContextGroupHandlerT<G>,
      HandlerData<HandlerContextGroupHandlerT<G>>,
      Handler<HandlerContextGroupHandlerT<G>, unknown, unknown, HandlerContextGroupContext<G>>
    >
  > => Record.get((handlerContextGroup as InferHandlerContextGroup<G>).record, key),
);
