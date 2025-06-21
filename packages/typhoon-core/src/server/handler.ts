import { MutationHandlerConfig, SubscriptionHandlerConfig } from "../config";

export type SubscriptionHandlerContext<
  Config extends SubscriptionHandlerConfig = SubscriptionHandlerConfig,
> = {
  config: Config;
};

export type MutationHandlerContext<
  Config extends MutationHandlerConfig = MutationHandlerConfig,
> = {
  config: Config;
};
