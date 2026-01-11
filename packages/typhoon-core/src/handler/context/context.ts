import { Data, pipe, Types, Function } from "effect";
import { Option } from "effect";
import { none, type GetOrUndefined, getOrUndefined } from "~/utils/strictOption";
import type { BaseHandlerT, HandlerData, Handler } from "../type";

export type BasePartialHandlerContext<
  HandlerT extends BaseHandlerT,
  D extends Option.Option<HandlerData<HandlerT>> = Option.Option<HandlerData<HandlerT>>,
  H extends Option.Option<Handler<HandlerT>> = Option.Option<Handler<HandlerT>>,
> = {
  data: D;
  handler: H;
};

const PartialHandlerContextTypeId = Symbol("Typhoon/Handler/PartialHandlerContextTypeId");
export type PartialHandlerContextTypeId = typeof PartialHandlerContextTypeId;

interface Variance<in out HandlerT extends BaseHandlerT> {
  [PartialHandlerContextTypeId]: {
    _HandlerT: Types.Invariant<HandlerT>;
  };
}

const partialHandlerContextVariance: <
  HandlerT extends BaseHandlerT,
>() => Variance<HandlerT>[PartialHandlerContextTypeId] = () => ({
  _HandlerT: Function.identity,
});

export class PartialHandlerContext<
  HandlerT extends BaseHandlerT,
  D extends Option.Option<HandlerData<HandlerT>> = Option.Option<HandlerData<HandlerT>>,
  H extends Option.Option<Handler<HandlerT>> = Option.Option<Handler<HandlerT>>,
>
  extends Data.TaggedClass("PartialHandlerContext")<{
    data: BasePartialHandlerContext<HandlerT, D, H>;
  }>
  implements Variance<HandlerT>
{
  [PartialHandlerContextTypeId] = partialHandlerContextVariance<HandlerT>();
}

export type PartialHandlerContextHandlerT<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Config extends PartialHandlerContext<any>,
> =
  Types.Invariant.Type<Config[PartialHandlerContextTypeId]["_HandlerT"]> extends infer HT extends
    BaseHandlerT
    ? HT
    : never;

export type HandlerContext<
  HandlerT extends BaseHandlerT,
  D extends HandlerData<HandlerT> = HandlerData<HandlerT>,
  H extends Handler<HandlerT> = Handler<HandlerT>,
> = PartialHandlerContext<HandlerT, Option.Some<D>, Option.Some<H>>;

export const empty = <HandlerT extends BaseHandlerT>() =>
  new PartialHandlerContext<
    HandlerT,
    Option.None<HandlerData<HandlerT>>,
    Option.None<Handler<HandlerT>>
  >({
    data: {
      data: none(),
      handler: none(),
    },
  });

export type DataOption<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Config extends PartialHandlerContext<any>,
> = Config["data"]["data"];
export type DataOrUndefined<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Config extends PartialHandlerContext<any>,
> = GetOrUndefined<DataOption<Config>>;

export const data = <
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Config extends PartialHandlerContext<any>,
>(
  config: Config,
) => pipe(config.data.data, getOrUndefined) as DataOrUndefined<Config>;

export type HandlerOption<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Config extends PartialHandlerContext<any>,
> = Config["data"]["handler"];
export type HandlerOrUndefined<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Config extends PartialHandlerContext<any>,
> =
  GetOrUndefined<HandlerOption<Config>> extends infer H extends Handler<
    PartialHandlerContextHandlerT<Config>
  >
    ? H
    : never;

export const handler = <
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Config extends PartialHandlerContext<any>,
>(
  config: Config,
) => pipe(config.data.handler, getOrUndefined) as HandlerOrUndefined<Config>;
