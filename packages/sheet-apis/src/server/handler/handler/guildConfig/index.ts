import { pipe } from "effect";
import { HandlerContextConfig } from "typhoon-core/config";

import { addGuildManagerRoleHandler } from "./addGuildManagerRole";
import { getGuildConfigByGuildIdHandler } from "./getGuildConfigByGuildId";
import { getGuildConfigByScriptIdHandler } from "./getGuildConfigByScriptId";
import { getGuildManagerRolesHandler } from "./getGuildManagerRoles";
import { getGuildRunningChannelByIdHandler } from "./getGuildRunningChannelById";
import { getGuildRunningChannelByNameHandler } from "./getGuildRunningChannelByName";
import { removeGuildManagerRoleHandler } from "./removeGuildManagerRole";
import { upsertGuildChannelConfigHandler } from "./upsertGuildChannelConfig";
import { upsertGuildConfigHandler } from "./upsertGuildConfig";

export const guildConfigHandlerGroup = pipe(
  HandlerContextConfig.Group.empty(),
  HandlerContextConfig.Group.add(getGuildConfigByGuildIdHandler),
  HandlerContextConfig.Group.add(getGuildConfigByScriptIdHandler),
  HandlerContextConfig.Group.add(upsertGuildConfigHandler),
  HandlerContextConfig.Group.add(getGuildManagerRolesHandler),
  HandlerContextConfig.Group.add(addGuildManagerRoleHandler),
  HandlerContextConfig.Group.add(removeGuildManagerRoleHandler),
  HandlerContextConfig.Group.add(upsertGuildChannelConfigHandler),
  HandlerContextConfig.Group.add(getGuildRunningChannelByIdHandler),
  HandlerContextConfig.Group.add(getGuildRunningChannelByNameHandler),
);
