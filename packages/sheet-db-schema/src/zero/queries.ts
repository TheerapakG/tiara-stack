import { defineQueries } from "@rocicorp/zero";
import { guildConfig, messageCheckin, messageSlot, messageRoomOrder } from "./queries/";

export const queries = defineQueries({
  guildConfig,
  messageCheckin,
  messageSlot,
  messageRoomOrder,
});

export type Queries = typeof queries;
