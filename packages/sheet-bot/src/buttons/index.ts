import { pipe } from "effect";
import { InteractionHandlerMap, buttonInteractionHandlerMap } from "../types";
import { button as checkinButton } from "./checkin";
import { button as slotButton } from "./slot";

export { checkinButton, slotButton };

export const buttons = pipe(
  buttonInteractionHandlerMap(),
  InteractionHandlerMap.add(slotButton),
  InteractionHandlerMap.add(checkinButton),
);
