import { pipe } from "effect";
import { InteractionHandlerMap, buttonInteractionHandlerMap } from "../types";
import { button as checkinButton } from "./checkin";
import {
  roomOrderActionRow,
  roomOrderNextButton,
  roomOrderPreviousButton,
  roomOrderSendButton,
} from "./roomOrder";
import { button as slotButton } from "./slot";

export {
  checkinButton,
  roomOrderActionRow,
  roomOrderNextButton,
  roomOrderPreviousButton,
  roomOrderSendButton,
  slotButton,
};

export const buttons = pipe(
  buttonInteractionHandlerMap(),
  InteractionHandlerMap.add(slotButton),
  InteractionHandlerMap.add(checkinButton),
  InteractionHandlerMap.add(roomOrderPreviousButton),
  InteractionHandlerMap.add(roomOrderNextButton),
  InteractionHandlerMap.add(roomOrderSendButton),
);
