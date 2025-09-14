import { pipe } from "effect";
import { HandlerConfigGroup } from "typhoon-server/config";

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
  HandlerConfigGroup.empty(),
  HandlerConfigGroup.add(getGuildConfigByGuildIdHandlerConfig),
  HandlerConfigGroup.add(getGuildConfigByScriptIdHandlerConfig),
  HandlerConfigGroup.add(upsertGuildConfigHandlerConfig),
  HandlerConfigGroup.add(getGuildManagerRolesHandlerConfig),
  HandlerConfigGroup.add(addGuildManagerRoleHandlerConfig),
  HandlerConfigGroup.add(removeGuildManagerRoleHandlerConfig),
  HandlerConfigGroup.add(upsertGuildChannelConfigHandlerConfig),
  HandlerConfigGroup.add(getGuildRunningChannelByIdHandlerConfig),
  HandlerConfigGroup.add(getGuildRunningChannelByNameHandlerConfig),
);
