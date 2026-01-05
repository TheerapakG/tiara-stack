import { HKT } from "effect";

export interface HandlerTypeLambda {
  readonly Success: unknown;
  readonly Error: unknown;
  readonly Context: unknown;
}

export type HandlerKind<
  F extends HandlerTypeLambda,
  Success,
  Error,
  Context,
> = F extends {
  readonly type: unknown;
}
  ? (F & {
      readonly Success: Success;
      readonly Error: Error;
      readonly Context: Context;
    })["type"]
  : never;

export interface TransformDataKeyTypeLambda {
  readonly In: unknown;
}

export type TransformDataKeyKind<
  F extends TransformDataKeyTypeLambda,
  In,
> = F extends {
  readonly type: string | symbol;
}
  ? (F & {
      readonly In: In;
    })["type"]
  : never;

export interface BaseHandlerT {
  readonly Type: string;
  readonly Data: unknown;
  readonly Handler: HandlerTypeLambda;
  readonly DefaultHandlerContext: unknown;
  readonly TransformDataKey: TransformDataKeyTypeLambda;
  readonly TransformDataSuccessIn: HKT.TypeLambda;
  readonly TransformDataSuccessOut: HKT.TypeLambda;
  readonly TransformDataErrorIn: HKT.TypeLambda;
  readonly TransformDataErrorOut: HKT.TypeLambda;
  readonly TransformDataContext: HKT.TypeLambda;
  readonly TransformHandlerSuccess: HKT.TypeLambda;
  readonly TransformHandlerError: HKT.TypeLambda;
  readonly TransformHandlerContext: HKT.TypeLambda;
}

export type HandlerType<HandlerT extends BaseHandlerT> =
  HandlerT["Type"] extends infer T extends string ? T : never;
export type HandlerData<HandlerT extends BaseHandlerT> = HandlerT["Data"];
export type Handler<
  HandlerT extends BaseHandlerT,
  Success = unknown,
  Error = unknown,
  Context = unknown,
> = HandlerT["Handler"] extends infer H extends HandlerTypeLambda
  ? HandlerKind<H, Success, Error, Context | HandlerDefaultContext<HandlerT>>
  : never;
export type HandlerDefaultContext<HandlerT extends BaseHandlerT> =
  HandlerT["DefaultHandlerContext"];

export type HandlerDataKey<
  HandlerT extends BaseHandlerT,
  D extends HandlerData<HandlerT>,
> = HandlerT["TransformDataKey"] extends infer F extends
  TransformDataKeyTypeLambda
  ? D extends infer DD
    ? TransformDataKeyKind<F, DD>
    : never
  : never;
export type HandlerDataSuccessIn<
  HandlerT extends BaseHandlerT,
  D extends HandlerData<HandlerT>,
> = HandlerT["TransformDataSuccessIn"] extends infer F extends HKT.TypeLambda
  ? D extends infer DD
    ? HKT.Kind<F, DD, unknown, unknown, unknown>
    : never
  : never;
export type HandlerDataSuccessOut<
  HandlerT extends BaseHandlerT,
  D extends HandlerData<HandlerT>,
> = HandlerT["TransformDataSuccessOut"] extends infer F extends HKT.TypeLambda
  ? D extends infer DD
    ? HKT.Kind<F, DD, unknown, unknown, unknown>
    : never
  : never;
export type HandlerDataErrorIn<
  HandlerT extends BaseHandlerT,
  D extends HandlerData<HandlerT>,
> = HandlerT["TransformDataErrorIn"] extends infer F extends HKT.TypeLambda
  ? D extends infer DD
    ? HKT.Kind<F, DD, unknown, unknown, unknown>
    : never
  : never;
export type HandlerDataErrorOut<
  HandlerT extends BaseHandlerT,
  D extends HandlerData<HandlerT>,
> = HandlerT["TransformDataErrorOut"] extends infer F extends HKT.TypeLambda
  ? D extends infer DD
    ? HKT.Kind<F, DD, unknown, unknown, unknown>
    : never
  : never;
export type HandlerDataContext<
  HandlerT extends BaseHandlerT,
  D extends HandlerData<HandlerT>,
> = Exclude<
  HandlerT["TransformDataContext"] extends infer F extends HKT.TypeLambda
    ? D extends infer DD
      ? HKT.Kind<F, DD, unknown, unknown, unknown>
      : never
    : never,
  HandlerT["DefaultHandlerContext"]
>;

export type HandlerSuccess<
  HandlerT extends BaseHandlerT,
  H extends Handler<HandlerT>,
> = HandlerT["TransformHandlerSuccess"] extends infer F extends HKT.TypeLambda
  ? H extends infer HH
    ? HKT.Kind<F, HH, unknown, unknown, unknown>
    : never
  : never;
export type HandlerError<
  HandlerT extends BaseHandlerT,
  H extends Handler<HandlerT>,
> = HandlerT["TransformHandlerError"] extends infer F extends HKT.TypeLambda
  ? H extends infer HH
    ? HKT.Kind<F, HH, unknown, unknown, unknown>
    : never
  : never;
export type HandlerContext<
  HandlerT extends BaseHandlerT,
  H extends Handler<HandlerT>,
> = Exclude<
  HandlerT["TransformHandlerContext"] extends infer F extends HKT.TypeLambda
    ? H extends infer HH
      ? HKT.Kind<F, HH, unknown, unknown, unknown>
      : never
    : never,
  HandlerT["DefaultHandlerContext"]
>;
