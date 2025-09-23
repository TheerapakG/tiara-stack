import { pipe } from "effect";
import { HandlerConfig } from "typhoon-core/config";
import {
  calcHandlerConfigGroup,
  guildConfigHandlerConfigGroup,
} from "./server/handler/config";

export * as Schema from "./server/schema";

export const serverHandlerConfigGroup = pipe(
  HandlerConfig.Group.empty(),
  HandlerConfig.Group.addGroup(calcHandlerConfigGroup),
  HandlerConfig.Group.addGroup(guildConfigHandlerConfigGroup),
);
