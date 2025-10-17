import { Option } from "effect";
import {
  empty as baseEmpty,
  HandlerConfigGroup,
  add as baseAdd,
  addGroup as baseAddGroup,
  getHandlerConfig as baseGetHandlerConfig,
} from "../shared/group";
import { type SubscriptionHandlerConfig } from "./data";

export type SubscriptionHandlerConfigGroup =
  HandlerConfigGroup<SubscriptionHandlerConfig>;

export const empty = () => baseEmpty<SubscriptionHandlerConfig>();

export const add = (
  handlerConfig: SubscriptionHandlerConfig,
): ((
  handlerConfigGroup: SubscriptionHandlerConfigGroup,
) => SubscriptionHandlerConfigGroup) => baseAdd(handlerConfig);

export const addGroup = (
  otherGroup: SubscriptionHandlerConfigGroup,
): ((
  thisGroup: SubscriptionHandlerConfigGroup,
) => SubscriptionHandlerConfigGroup) => baseAddGroup(otherGroup);

export const getHandlerConfig = (
  key: string,
): ((
  handlerConfigGroup: SubscriptionHandlerConfigGroup,
) => Option.Option<SubscriptionHandlerConfig>) => baseGetHandlerConfig(key);
