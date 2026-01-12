import { pipe } from "effect";
import { Data as HandlerData } from "typhoon-server/handler";

import { addGuildManagerRoleHandlerData } from "./addGuildManagerRole";
import { getGuildConfigByGuildIdHandlerData } from "./getGuildConfigByGuildId";
import { getGuildConfigByScriptIdHandlerData } from "./getGuildConfigByScriptId";
import { getGuildManagerRolesHandlerData } from "./getGuildManagerRoles";
import { getGuildRunningChannelByIdHandlerData } from "./getGuildRunningChannelById";
import { getGuildRunningChannelByNameHandlerData } from "./getGuildRunningChannelByName";
import { removeGuildManagerRoleHandlerData } from "./removeGuildManagerRole";
import { upsertGuildChannelConfigHandlerData } from "./upsertGuildChannelConfig";
import { upsertGuildConfigHandlerData } from "./upsertGuildConfig";
import { getAutoCheckinGuildsHandlerData } from "./getAutoCheckinGuilds";

export {
  addGuildManagerRoleHandlerData,
  getGuildConfigByGuildIdHandlerData,
  getGuildConfigByScriptIdHandlerData,
  getGuildManagerRolesHandlerData,
  getGuildRunningChannelByIdHandlerData,
  getGuildRunningChannelByNameHandlerData,
  removeGuildManagerRoleHandlerData,
  upsertGuildChannelConfigHandlerData,
  upsertGuildConfigHandlerData,
  getAutoCheckinGuildsHandlerData,
};

export const guildConfigHandlerDataCollection = pipe(
  HandlerData.Collection.empty(),
  HandlerData.Collection.addSubscription(getGuildConfigByGuildIdHandlerData),
  HandlerData.Collection.addSubscription(getGuildConfigByScriptIdHandlerData),
  HandlerData.Collection.addMutation(upsertGuildConfigHandlerData),
  HandlerData.Collection.addSubscription(getGuildManagerRolesHandlerData),
  HandlerData.Collection.addMutation(addGuildManagerRoleHandlerData),
  HandlerData.Collection.addMutation(removeGuildManagerRoleHandlerData),
  HandlerData.Collection.addMutation(upsertGuildChannelConfigHandlerData),
  HandlerData.Collection.addSubscription(getGuildRunningChannelByIdHandlerData),
  HandlerData.Collection.addSubscription(getGuildRunningChannelByNameHandlerData),
  HandlerData.Collection.addSubscription(getAutoCheckinGuildsHandlerData),
);
