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

export const add = (handlerConfig: SubscriptionHandlerConfig) =>
  baseAdd(handlerConfig);

export const addGroup = (otherGroup: SubscriptionHandlerConfigGroup) =>
  baseAddGroup(otherGroup);

export const getHandlerConfig = (key: string) => baseGetHandlerConfig(key);
