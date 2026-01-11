import { pipe } from "effect";
import { Data as HandlerData } from "typhoon-server/handler";

import { addGuildManagerRoleHandlerConfig } from "./addGuildManagerRole";
import { getGuildConfigByGuildIdHandlerConfig } from "./getGuildConfigByGuildId";
import { getGuildConfigByScriptIdHandlerConfig } from "./getGuildConfigByScriptId";
import { getGuildManagerRolesHandlerConfig } from "./getGuildManagerRoles";
import { getGuildRunningChannelByIdHandlerConfig } from "./getGuildRunningChannelById";
import { getGuildRunningChannelByNameHandlerConfig } from "./getGuildRunningChannelByName";
import { removeGuildManagerRoleHandlerConfig } from "./removeGuildManagerRole";
import { upsertGuildChannelConfigHandlerConfig } from "./upsertGuildChannelConfig";
import { upsertGuildConfigHandlerConfig } from "./upsertGuildConfig";
import { getAutoCheckinGuildsHandlerConfig } from "./getAutoCheckinGuilds";

export {
  addGuildManagerRoleHandlerConfig,
  getGuildConfigByGuildIdHandlerConfig,
  getGuildConfigByScriptIdHandlerConfig,
  getGuildManagerRolesHandlerConfig,
  getGuildRunningChannelByIdHandlerConfig,
  getGuildRunningChannelByNameHandlerConfig,
  removeGuildManagerRoleHandlerConfig,
  upsertGuildChannelConfigHandlerConfig,
  upsertGuildConfigHandlerConfig,
  getAutoCheckinGuildsHandlerConfig,
};

export const guildConfigHandlerDataCollection = pipe(
  HandlerData.Collection.empty(),
  HandlerData.Collection.addSubscription(getGuildConfigByGuildIdHandlerConfig),
  HandlerData.Collection.addSubscription(getGuildConfigByScriptIdHandlerConfig),
  HandlerData.Collection.addMutation(upsertGuildConfigHandlerConfig),
  HandlerData.Collection.addSubscription(getGuildManagerRolesHandlerConfig),
  HandlerData.Collection.addMutation(addGuildManagerRoleHandlerConfig),
  HandlerData.Collection.addMutation(removeGuildManagerRoleHandlerConfig),
  HandlerData.Collection.addMutation(upsertGuildChannelConfigHandlerConfig),
  HandlerData.Collection.addSubscription(getGuildRunningChannelByIdHandlerConfig),
  HandlerData.Collection.addSubscription(getGuildRunningChannelByNameHandlerConfig),
  HandlerData.Collection.addSubscription(getAutoCheckinGuildsHandlerConfig),
);
