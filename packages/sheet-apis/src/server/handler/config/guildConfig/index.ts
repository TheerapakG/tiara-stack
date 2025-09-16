import { pipe } from "effect";
import { HandlerConfig } from "typhoon-core/config";

import { addGuildManagerRoleHandlerConfig } from "./addGuildManagerRole";
import { getGuildConfigByGuildIdHandlerConfig } from "./getGuildConfigByGuildId";
import { getGuildConfigByScriptIdHandlerConfig } from "./getGuildConfigByScriptId";
import { getGuildManagerRolesHandlerConfig } from "./getGuildManagerRoles";
import { getGuildRunningChannelByIdHandlerConfig } from "./getGuildRunningChannelById";
import { getGuildRunningChannelByNameHandlerConfig } from "./getGuildRunningChannelByName";
import { removeGuildManagerRoleHandlerConfig } from "./removeGuildManagerRole";
import { upsertGuildChannelConfigHandlerConfig } from "./upsertGuildChannelConfig";
import { upsertGuildConfigHandlerConfig } from "./upsertGuildConfig";

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
};

export const guildConfigHandlerConfigGroup = pipe(
  HandlerConfig.Group.empty(),
  HandlerConfig.Group.add(getGuildConfigByGuildIdHandlerConfig),
  HandlerConfig.Group.add(getGuildConfigByScriptIdHandlerConfig),
  HandlerConfig.Group.add(upsertGuildConfigHandlerConfig),
  HandlerConfig.Group.add(getGuildManagerRolesHandlerConfig),
  HandlerConfig.Group.add(addGuildManagerRoleHandlerConfig),
  HandlerConfig.Group.add(removeGuildManagerRoleHandlerConfig),
  HandlerConfig.Group.add(upsertGuildChannelConfigHandlerConfig),
  HandlerConfig.Group.add(getGuildRunningChannelByIdHandlerConfig),
  HandlerConfig.Group.add(getGuildRunningChannelByNameHandlerConfig),
);
