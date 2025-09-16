import { pipe } from "effect";
import { HandlerConfig } from "typhoon-core/config";
import {
  calcHandlerConfigGroup,
  guildConfigHandlerConfigGroup,
  testHandlerConfigGroup,
} from "./server/handler/config";

export const serverHandlerConfigGroup = pipe(
  HandlerConfig.Group.empty(),
  HandlerConfig.Group.addGroup(calcHandlerConfigGroup),
  HandlerConfig.Group.addGroup(guildConfigHandlerConfigGroup),
  HandlerConfig.Group.addGroup(testHandlerConfigGroup),
);
