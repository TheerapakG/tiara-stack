import { pipe } from "effect";
import { ChatInputCommandHandlerMap } from "../../types";
import { command as server } from "./server";
import { command as slot } from "./slot";
import { command as team } from "./team";

export const commands = pipe(
  ChatInputCommandHandlerMap.empty(),
  ChatInputCommandHandlerMap.add(server),
  ChatInputCommandHandlerMap.add(slot),
  ChatInputCommandHandlerMap.add(team),
);
