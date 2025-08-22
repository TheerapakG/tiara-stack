import { HKT } from "effect";
import { BaseBaseInteractionT, InteractionContext } from "@/services";
import {
  InteractionHandler,
  InteractionHandlerContext,
  InteractionHandlerContextBuilder,
  InteractionHandlerMap,
} from "./handler";

export type HandlerVariant<
  Data = unknown,
  I extends BaseBaseInteractionT = BaseBaseInteractionT,
> = {
  data: Data;
  interaction: I;
};

export interface HandlerVariantT extends HKT.TypeLambda {
  readonly type: HandlerVariant;
}

export type HandlerVariantKind<F extends HandlerVariantT> = HKT.Kind<
  F,
  never,
  never,
  never,
  never
>;

export type HandlerVariantData<Variant extends HandlerVariantT> =
  HandlerVariantKind<Variant>["data"];

export type HandlerVariantInteraction<Variant extends HandlerVariantT> =
  HandlerVariantKind<Variant>["interaction"];

export type HandlerVariantInteractionContext<Variant extends HandlerVariantT> =
  InteractionContext<HandlerVariantInteraction<Variant>>;

export type HandlerVariantHandler<
  Variant extends HandlerVariantT,
  A = never,
  E = never,
  R = never,
> = InteractionHandler<A, E, R | HandlerVariantInteractionContext<Variant>>;

export type HandlerVariantHandlerContext<
  Variant extends HandlerVariantT,
  A = never,
  E = never,
  R = never,
> = InteractionHandlerContext<
  HandlerVariantData<Variant>,
  A,
  E,
  R | HandlerVariantInteractionContext<Variant>
>;

export const handlerVariantContextBuilder = <
  Variant extends HandlerVariantT,
>() =>
  InteractionHandlerContextBuilder.empty<
    HandlerVariantData<Variant>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    HandlerVariantHandler<Variant, any, any, any>
  >();

export type HandlerVariantMap<
  Variant extends HandlerVariantT,
  A = never,
  E = never,
  R = never,
> = InteractionHandlerMap<
  HandlerVariantData<Variant>,
  A,
  E,
  R | HandlerVariantInteractionContext<Variant>
>;

export const handlerVariantMap = <
  Variant extends HandlerVariantT,
  A = never,
  E = never,
  R = never,
>(
  keyGetter: (data: HandlerVariantData<Variant>) => string,
) =>
  InteractionHandlerMap.empty<
    HandlerVariantData<Variant>,
    A,
    E,
    R | HandlerVariantInteractionContext<Variant>
  >(keyGetter);
