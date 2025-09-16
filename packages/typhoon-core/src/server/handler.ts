import { HandlerConfig } from "../config";

export type SubscriptionHandlerContext<
  Config extends
    HandlerConfig.SubscriptionHandlerConfig = HandlerConfig.SubscriptionHandlerConfig,
> = {
  config: Config;
};

export type MutationHandlerContext<
  Config extends
    HandlerConfig.MutationHandlerConfig = HandlerConfig.MutationHandlerConfig,
> = {
  config: Config;
};
