import { pipe } from "effect";
import { ChatInputCommandHandlerMap } from "../../types/handler";
import { command as slot } from "./slot";
import { command as team } from "./team";

export const commands = pipe(
  ChatInputCommandHandlerMap.empty(),
  ChatInputCommandHandlerMap.add(slot),
  ChatInputCommandHandlerMap.add(team),
);
