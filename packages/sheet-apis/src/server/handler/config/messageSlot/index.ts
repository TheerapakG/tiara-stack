import { pipe } from "effect";
import { Handler } from "typhoon-core/server";

import { getMessageSlotDataHandlerConfig } from "./getMessageSlotData";
import { upsertMessageSlotDataHandlerConfig } from "./upsertMessageSlotData";

export { getMessageSlotDataHandlerConfig, upsertMessageSlotDataHandlerConfig };

export const messageSlotHandlerConfigCollection = pipe(
  Handler.Config.Collection.empty(),
  Handler.Config.Collection.add(getMessageSlotDataHandlerConfig),
  Handler.Config.Collection.add(upsertMessageSlotDataHandlerConfig),
);
