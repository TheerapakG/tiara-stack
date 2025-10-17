import { Struct } from "effect";
import { some } from "../../utils/strictOption";
import type {
  BaseHandlerT,
  Handler,
  HandlerData,
  HandlerDataContext,
  HandlerDataError,
  HandlerDataSuccessIn,
  HandlerContext,
  HandlerError,
  HandlerSuccess,
} from "../type";
import { PartialHandlerContext, type DataOrUndefined, empty } from "./context";

import { Option } from "effect";

export type SetDataInput<HandlerT extends BaseHandlerT> = PartialHandlerContext<
  HandlerT,
  Option.None<HandlerData<HandlerT>>,
  Option.None<Handler<HandlerT>>
>;
export type SetDataOutput<
  HandlerT extends BaseHandlerT,
  D extends HandlerData<HandlerT>,
> = PartialHandlerContext<
  HandlerT,
  Option.Some<D>,
  Option.None<Handler<HandlerT>>
>;

export const data =
  <HandlerT extends BaseHandlerT>() =>
  <const D extends HandlerData<HandlerT>>(d: D) =>
  <const Input extends SetDataInput<HandlerT>>(config: Input) =>
    new PartialHandlerContext({
      data: Struct.evolve(config.data, {
        data: () => some(d),
      }),
    }) as SetDataOutput<HandlerT, D>;

export type SetHandlerInput<HandlerT extends BaseHandlerT> =
  PartialHandlerContext<
    HandlerT,
    Option.Some<HandlerData<HandlerT>>,
    Option.None<Handler<HandlerT>>
  >;
export type SetHandlerOutput<
  HandlerT extends BaseHandlerT,
  Input extends SetHandlerInput<HandlerT>,
  H extends Handler<HandlerT>,
> =
  DataOrUndefined<Input> extends infer D extends HandlerData<HandlerT>
    ? [
        HandlerSuccess<HandlerT, H>,
        HandlerError<HandlerT, H>,
        HandlerContext<HandlerT, H>,
      ] extends [
        HandlerDataSuccessIn<HandlerT, D>,
        HandlerDataError<HandlerT, D>,
        HandlerDataContext<HandlerT, D>,
      ]
      ? PartialHandlerContext<HandlerT, Option.Some<D>, Option.Some<H>>
      : never
    : never;

export const handler =
  <HandlerT extends BaseHandlerT>() =>
  <const H extends Handler<HandlerT>>(h: H) =>
  <const Input extends SetHandlerInput<HandlerT>>(config: Input) =>
    new PartialHandlerContext({
      data: Struct.evolve(config.data, {
        handler: () => some(h),
      }),
    }) as SetHandlerOutput<HandlerT, Input, H>;

export type Builders<HandlerT extends BaseHandlerT> = {
  empty: () => PartialHandlerContext<
    HandlerT,
    Option.None<HandlerData<HandlerT>>,
    Option.None<Handler<HandlerT>>
  >;
  data: <const D extends HandlerData<HandlerT>>(
    d: D,
  ) => <const Input extends SetDataInput<HandlerT>>(
    config: Input,
  ) => SetDataOutput<HandlerT, D>;
  handler: <const H extends Handler<HandlerT>>(
    h: H,
  ) => <const Input extends SetHandlerInput<HandlerT>>(
    config: Input,
  ) => SetHandlerOutput<HandlerT, Input, H>;
};

export const builders = <
  HandlerT extends BaseHandlerT,
>(): Builders<HandlerT> => ({
  empty: () => empty<HandlerT>(),
  data: data<HandlerT>(),
  handler: handler<HandlerT>(),
});
