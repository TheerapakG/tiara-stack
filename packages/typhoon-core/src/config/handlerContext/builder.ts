import { Struct } from "effect";
import { some, type ValueExtends } from "../../utils/strictOption";
import { type HandlerConfig } from "../handler";
import {
  type ConfigOption,
  type Handler,
  type InferHandlerConfig,
  PartialHandlerContextConfig,
} from "./data";

import { Option } from "effect";

export type SetConfigInput = PartialHandlerContextConfig<
  Option.None<HandlerConfig>
>;
export type SetConfigOutput<Config extends HandlerConfig> =
  PartialHandlerContextConfig<
    Option.Some<Config>,
    Option.None<Handler<Config>>
  >;

export const config =
  <const Config extends HandlerConfig>(c: Config) =>
  <const Input extends SetConfigInput>(config: Input) =>
    new PartialHandlerContextConfig({
      data: Struct.evolve(config.data, {
        config: () => some(c),
      }),
    }) as SetConfigOutput<Config>;

export type SetHandlerInput<H extends Handler> = PartialHandlerContextConfig<
  Option.Some<InferHandlerConfig<H>>,
  Option.None<Handler<InferHandlerConfig<H>>>
>;
export type SetHandlerOutput<
  H extends Handler,
  Config extends SetHandlerInput<H>,
> =
  ConfigOption<Config> extends infer InferConfig extends Option.Some<
    InferHandlerConfig<H>
  >
    ? H extends infer InferHandler extends Handler<
        ValueExtends<InferConfig, HandlerConfig>
      >
      ? PartialHandlerContextConfig<InferConfig, Option.Some<InferHandler>>
      : never
    : never;

export const handler =
  <const H extends Handler>(handler: H) =>
  <const Config extends SetHandlerInput<H>>(config: Config) =>
    new PartialHandlerContextConfig({
      data: Struct.evolve(config.data, {
        handler: () =>
          some(handler as unknown as Handler<InferHandlerConfig<H>>),
      }),
    }) as unknown as SetHandlerOutput<H, Config>;
