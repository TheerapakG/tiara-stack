import { defineMutators } from "@rocicorp/zero";
import { guildConfig, messageCheckin, messageRoomOrder, messageSlot } from "./mutators/";

export const mutators = defineMutators({
  guildConfig,
  messageCheckin,
  messageRoomOrder,
  messageSlot,
});

export type Mutators = typeof mutators;
