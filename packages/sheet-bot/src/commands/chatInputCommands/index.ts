import { pipe } from "effect";
import { InteractionHandlerMap, chatInputCommandHandlerMap } from "../../types";
import { command as channel } from "./channel";
import { command as checkin } from "./checkin";
import { command as kickout } from "./kickout";
import { command as server } from "./server";
import { command as slot } from "./slot";
import { command as team } from "./team";

export const commands = pipe(
  chatInputCommandHandlerMap(),
  InteractionHandlerMap.add(channel),
  InteractionHandlerMap.add(checkin),
  InteractionHandlerMap.add(kickout),
  InteractionHandlerMap.add(server),
  InteractionHandlerMap.add(slot),
  InteractionHandlerMap.add(team),
);
