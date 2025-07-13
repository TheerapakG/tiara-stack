import { pipe } from "effect";
import { ButtonInteractionHandlerMap } from "../types";
import { button as slot } from "./slot";

export const buttons = pipe(
  ButtonInteractionHandlerMap.empty(),
  ButtonInteractionHandlerMap.add(slot),
);
