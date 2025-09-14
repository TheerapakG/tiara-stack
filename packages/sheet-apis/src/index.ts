import { pipe } from "effect";
import { HandlerConfigGroup } from "typhoon-server/config";
import {
  calcHandlerConfigGroup,
  guildConfigHandlerConfigGroup,
  testHandlerConfigGroup,
} from "./server/handler/config";

export const serverHandlerConfigGroup = pipe(
  HandlerConfigGroup.empty(),
  HandlerConfigGroup.addGroup(calcHandlerConfigGroup),
  HandlerConfigGroup.addGroup(guildConfigHandlerConfigGroup),
  HandlerConfigGroup.addGroup(testHandlerConfigGroup),
);
