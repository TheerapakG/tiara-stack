import { Data, Function, Struct, Types, Option } from "effect";
import {
  HandlerContextGroup,
  empty as emptyHandlerContextGroup,
  add as addHandlerContextGroup,
  addGroup as addGroupHandlerContextGroup,
  getHandlerContext as getGroupHandlerContext,
} from "./group";
import {
  type HandlerContext,
  type PartialHandlerContextHandlerT,
  type HandlerOrUndefined,
} from "./context";
import {
  type BaseHandlerT,
  type HandlerData,
  type Handler,
  type HandlerType,
  type HandlerDataKey,
  type HandlerContext as HandlerEffectContext,
} from "../type";

type HandlerContextGroupStruct<HandlerT extends BaseHandlerT, R> = {
  [HT in HandlerT as HandlerType<HT>]: HandlerContextGroup<HT, R>;
};
type HandlerContextTypeTransformer<HandlerT extends BaseHandlerT> = (
  handlerContext: HandlerT extends HandlerT
    ? HandlerContext<HandlerT, HandlerData<HandlerT>, Handler<HandlerT>>
    : never,
) => HandlerType<HandlerT>;

const HandlerContextCollectionTypeId = Symbol(
  "Typhoon/Handler/HandlerContextCollectionTypeId",
);
export type HandlerContextCollectionTypeId =
  typeof HandlerContextCollectionTypeId;

interface Variance<in out HandlerT extends BaseHandlerT, out R> {
  [HandlerContextCollectionTypeId]: {
    _HandlerT: Types.Invariant<HandlerT>;
    _R: Types.Covariant<R>;
  };
}

const handlerContextCollectionVariance: <
  HandlerT extends BaseHandlerT,
  R,
>() => Variance<HandlerT, R>[HandlerContextCollectionTypeId] = () => ({
  _HandlerT: Function.identity,
  _R: Function.identity,
});

export class HandlerContextCollection<HandlerT extends BaseHandlerT, R = never>
  extends Data.TaggedClass("HandlerContextCollection")<{
    struct: HandlerContextGroupStruct<HandlerT, R>;
    handlerContextTypeTransformer: HandlerContextTypeTransformer<HandlerT>;
  }>
  implements Variance<HandlerT, R>
{
  [HandlerContextCollectionTypeId] = handlerContextCollectionVariance<
    HandlerT,
    R
  >();
}

export type HandlerContextCollectionHandlerT<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  C extends HandlerContextCollection<any, any>,
> = Types.Invariant.Type<C[HandlerContextCollectionTypeId]["_HandlerT"]>;
export type HandlerContextCollectionContext<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  C extends HandlerContextCollection<any, any>,
> = Types.Covariant.Type<C[HandlerContextCollectionTypeId]["_R"]>;

type HandlerDataKeyTransformerStruct<HandlerT extends BaseHandlerT> = {
  [HT in HandlerT as HandlerType<HT>]: (
    data: HandlerData<HT>,
  ) => HandlerDataKey<HT, HandlerData<HT>>;
};
export const empty = <HandlerT extends BaseHandlerT, R = never>(
  dataKeyTransformers: HandlerDataKeyTransformerStruct<HandlerT>,
  handlerContextTypeTransformer: HandlerContextTypeTransformer<HandlerT>,
) =>
  new HandlerContextCollection<HandlerT, R>({
    struct: Object.fromEntries(
      Object.entries(dataKeyTransformers).map(([type, transformer]) => [
        type,
        emptyHandlerContextGroup<HandlerT, R>(
          transformer as (
            data: HandlerData<HandlerT>,
          ) => HandlerDataKey<HandlerT, HandlerData<HandlerT>>,
        ),
      ]),
    ) as unknown as HandlerContextGroupStruct<HandlerT, R>,
    handlerContextTypeTransformer,
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
    const C extends HandlerContextCollection<any, any>,
    CollectionHandlerT extends
      HandlerContextCollectionHandlerT<C> = HandlerContextCollectionHandlerT<C>,
  >(
    handlerContextCollection: C,
  ) =>
    new HandlerContextCollection<
      HandlerT extends CollectionHandlerT ? CollectionHandlerT : never,
      HandlerOrUndefined<Config> extends infer H extends Handler<HandlerT>
        ? HandlerContextCollectionContext<C> | HandlerEffectContext<HandlerT, H>
        : never
    >(
      Struct.evolve(handlerContextCollection, {
        struct: (struct) =>
          Struct.evolve(struct, {
            [handlerContextCollection.handlerContextTypeTransformer(
              handlerContextConfig,
            )]: (
              group: HandlerContextGroup<
                HandlerT,
                HandlerContextCollectionContext<C>
              >,
            ) => addHandlerContextGroup(handlerContextConfig)(group),
          }) as unknown as HandlerContextGroupStruct<
            CollectionHandlerT,
            HandlerOrUndefined<Config> extends infer H extends Handler<HandlerT>
              ?
                  | HandlerContextCollectionContext<C>
                  | HandlerEffectContext<HandlerT, H>
              : never
          >,
      }),
    );

export const addCollection =
  <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const OtherC extends HandlerContextCollection<any, any>,
    HandlerT extends
      HandlerContextCollectionHandlerT<OtherC> = HandlerContextCollectionHandlerT<OtherC>,
  >(
    otherCollection: OtherC,
  ) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <const ThisC extends HandlerContextCollection<HandlerT, any>>(
    thisCollection: ThisC,
  ) =>
    new HandlerContextCollection<
      HandlerT,
      | HandlerContextCollectionContext<ThisC>
      | HandlerContextCollectionContext<OtherC>
    >(
      Struct.evolve(thisCollection, {
        struct: (struct) =>
          Object.fromEntries(
            Object.entries(struct).map(([type, group]) => [
              type,
              addGroupHandlerContextGroup(otherCollection.struct[type])(
                group as HandlerContextGroup<
                  HandlerT,
                  HandlerContextCollectionContext<OtherC>
                >,
              ),
            ]),
          ) as HandlerContextGroupStruct<
            HandlerT,
            | HandlerContextCollectionContext<ThisC>
            | HandlerContextCollectionContext<OtherC>
          >,
      }),
    );

export const getHandlerContext =
  <HandlerT extends BaseHandlerT>(
    type: HandlerType<HandlerT>,
    key: HandlerDataKey<HandlerT, HandlerData<HandlerT>>,
  ) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <const C extends HandlerContextCollection<any, any>>(
    handlerContextCollection: C,
  ): Option.Option<
    HandlerContext<
      HandlerT,
      HandlerData<HandlerT>,
      Handler<HandlerT, unknown, unknown, HandlerContextCollectionContext<C>>
    >
  > =>
    getGroupHandlerContext(key)(
      handlerContextCollection.struct[
        type
      ] as HandlerT extends HandlerContextCollectionHandlerT<C>
        ? HandlerContextGroup<HandlerT, HandlerContextCollectionContext<C>>
        : never,
    );
