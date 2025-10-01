import {
  empty as baseEmpty,
  HandlerConfigGroup,
  add as baseAdd,
  addGroup as baseAddGroup,
  getHandlerConfig as baseGetHandlerConfig,
} from "../shared/group";
import { type MutationHandlerConfig } from "./data";

export { HandlerConfigGroupTypeId } from "../shared/group";

export type MutationHandlerConfigGroup =
  HandlerConfigGroup<MutationHandlerConfig>;

export const empty = () => baseEmpty<MutationHandlerConfig>();

export const add = (handlerConfig: MutationHandlerConfig) =>
  baseAdd(handlerConfig);

export const addGroup = (otherGroup: MutationHandlerConfigGroup) =>
  baseAddGroup(otherGroup);

export const getHandlerConfig = (key: string) => baseGetHandlerConfig(key);
