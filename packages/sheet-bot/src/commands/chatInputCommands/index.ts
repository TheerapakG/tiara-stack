import { pipe } from "effect";
import {
  InteractionHandlerMap,
  chatInputInteractionHandlerMap,
} from "../../types";
import { command as channel } from "./channel";
import { command as checkin } from "./checkin";
import { command as kickout } from "./kickout";
import { command as roomOrder } from "./roomOrder";
import { command as server } from "./server";
import { command as slot } from "./slot";
import { command as team } from "./team";

export const commands = pipe(
  chatInputInteractionHandlerMap(),
  InteractionHandlerMap.add(channel),
  InteractionHandlerMap.add(checkin),
  InteractionHandlerMap.add(kickout),
  InteractionHandlerMap.add(roomOrder),
  InteractionHandlerMap.add(server),
  InteractionHandlerMap.add(slot),
  InteractionHandlerMap.add(team),
);
