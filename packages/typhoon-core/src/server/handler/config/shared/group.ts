import { Data, Function, HashMap, Option, Struct, Types } from "effect";
import { type BaseHandlerConfig } from "./data";

type HandlerConfigMap<HandlerConfig extends BaseHandlerConfig> =
  HashMap.HashMap<string, HandlerConfig>;

export const HandlerConfigGroupTypeId = Symbol(
  "Typhoon/Server/HandlerConfigGroupTypeId",
);
export type HandlerConfigGroupTypeId = typeof HandlerConfigGroupTypeId;

interface Variance<in out HandlerConfig extends BaseHandlerConfig> {
  [HandlerConfigGroupTypeId]: {
    _HandlerConfig: Types.Invariant<HandlerConfig>;
  };
}

const handlerConfigGroupVariance: <
  HandlerConfig extends BaseHandlerConfig,
>() => Variance<HandlerConfig>[HandlerConfigGroupTypeId] = () => ({
  _HandlerConfig: Function.identity,
});

export class HandlerConfigGroup<HandlerConfig extends BaseHandlerConfig>
  extends Data.TaggedClass("HandlerConfigGroup")<{
    map: HandlerConfigMap<HandlerConfig>;
  }>
  implements Variance<HandlerConfig>
{
  [HandlerConfigGroupTypeId] = handlerConfigGroupVariance<HandlerConfig>();
}

export type HandlerConfigGroupHandlerConfig<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  G extends HandlerConfigGroup<any>,
> = Types.Invariant.Type<G[HandlerConfigGroupTypeId]["_HandlerConfig"]>;

export const empty = <HandlerConfig extends BaseHandlerConfig>() =>
  new HandlerConfigGroup<HandlerConfig>({
    map: HashMap.empty(),
  });

export const add =
  <const Config extends BaseHandlerConfig>(handlerConfig: Config) =>
  <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const G extends HandlerConfigGroup<any>,
  >(
    handlerConfigGroup: G,
  ) =>
    new HandlerConfigGroup<
      Config extends HandlerConfigGroupHandlerConfig<G>
        ? HandlerConfigGroupHandlerConfig<G>
        : never
    >(
      Struct.evolve(handlerConfigGroup, {
        map: (map) =>
          HashMap.set(map, handlerConfig.data.name.value, handlerConfig),
      }),
    );

export const addGroup =
  <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const OtherG extends HandlerConfigGroup<any>,
  >(
    otherGroup: OtherG,
  ) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <const ThisG extends HandlerConfigGroup<any>>(thisGroup: ThisG) =>
    new HandlerConfigGroup<
      HandlerConfigGroupHandlerConfig<OtherG> extends HandlerConfigGroupHandlerConfig<ThisG>
        ? HandlerConfigGroupHandlerConfig<ThisG>
        : never
    >(
      Struct.evolve(thisGroup, {
        map: (map) => HashMap.union(map, otherGroup.map),
      }),
    );

export const getHandlerConfig =
  (key: string) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <G extends HandlerConfigGroup<any>>(handlerConfigGroup: G) =>
    HashMap.get(handlerConfigGroup.map, key) as Option.Option<
      HandlerConfigGroupHandlerConfig<G>
    >;
