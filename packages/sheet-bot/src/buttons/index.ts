import { pipe } from "effect";
import { ButtonInteractionHandlerMap } from "../types";
import { button as checkinButton } from "./checkin";
import { button as slotButton } from "./slot";

export { checkinButton, slotButton };

export const buttons = pipe(
  ButtonInteractionHandlerMap.empty(),
  ButtonInteractionHandlerMap.add(slotButton),
  ButtonInteractionHandlerMap.add(checkinButton),
);
