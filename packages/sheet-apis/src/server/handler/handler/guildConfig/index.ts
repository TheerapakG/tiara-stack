import { pipe } from "effect";
import { HandlerGroup } from "typhoon-server/server";

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
  HandlerGroup.empty(),
  HandlerGroup.add(getGuildConfigByGuildIdHandler),
  HandlerGroup.add(getGuildConfigByScriptIdHandler),
  HandlerGroup.add(upsertGuildConfigHandler),
  HandlerGroup.add(getGuildManagerRolesHandler),
  HandlerGroup.add(addGuildManagerRoleHandler),
  HandlerGroup.add(removeGuildManagerRoleHandler),
  HandlerGroup.add(upsertGuildChannelConfigHandler),
  HandlerGroup.add(getGuildRunningChannelByIdHandler),
  HandlerGroup.add(getGuildRunningChannelByNameHandler),
);
