import { Option } from "effect";
import {
  empty as baseEmpty,
  HandlerConfigGroup,
  add as baseAdd,
  addGroup as baseAddGroup,
  getHandlerConfig as baseGetHandlerConfig,
} from "../shared/group";
import { type MutationHandlerConfig } from "./data";

export type MutationHandlerConfigGroup =
  HandlerConfigGroup<MutationHandlerConfig>;

export const empty = () => baseEmpty<MutationHandlerConfig>();

export const add = (
  handlerConfig: MutationHandlerConfig,
): ((
  handlerConfigGroup: MutationHandlerConfigGroup,
) => MutationHandlerConfigGroup) => baseAdd(handlerConfig);

export const addGroup = (
  otherGroup: MutationHandlerConfigGroup,
): ((thisGroup: MutationHandlerConfigGroup) => MutationHandlerConfigGroup) =>
  baseAddGroup(otherGroup);

export const getHandlerConfig = (
  key: string,
): ((
  handlerConfigGroup: MutationHandlerConfigGroup,
) => Option.Option<MutationHandlerConfig>) => baseGetHandlerConfig(key);
