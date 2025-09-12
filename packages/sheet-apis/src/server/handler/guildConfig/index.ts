import { pipe } from "effect";
import { HandlerConfigGroup } from "typhoon-server/config";
import { HandlerGroup } from "typhoon-server/server";

import {
  addGuildManagerRoleHandler,
  addGuildManagerRoleHandlerConfig,
} from "./addGuildManagerRole";
import {
  getGuildConfigByGuildIdHandler,
  getGuildConfigByGuildIdHandlerConfig,
} from "./getGuildConfigByGuildId";
import {
  getGuildConfigByScriptIdHandler,
  getGuildConfigByScriptIdHandlerConfig,
} from "./getGuildConfigByScriptId";
import {
  getGuildManagerRolesHandler,
  getGuildManagerRolesHandlerConfig,
} from "./getGuildManagerRoles";
import {
  getGuildRunningChannelByIdHandler,
  getGuildRunningChannelByIdHandlerConfig,
} from "./getGuildRunningChannelById";
import {
  getGuildRunningChannelByNameHandler,
  getGuildRunningChannelByNameHandlerConfig,
} from "./getGuildRunningChannelByName";
import {
  removeGuildManagerRoleHandler,
  removeGuildManagerRoleHandlerConfig,
} from "./removeGuildManagerRole";
import {
  setGuildChannelConfigHandler,
  setGuildChannelConfigHandlerConfig,
} from "./setGuildChannelConfig";
import {
  upsertGuildConfigHandler,
  upsertGuildConfigHandlerConfig,
} from "./upsertGuildConfig";

export const guildConfigHandlerConfigGroup = pipe(
  HandlerConfigGroup.empty(),
  HandlerConfigGroup.add(getGuildConfigByGuildIdHandlerConfig),
  HandlerConfigGroup.add(getGuildConfigByScriptIdHandlerConfig),
  HandlerConfigGroup.add(upsertGuildConfigHandlerConfig),
  HandlerConfigGroup.add(getGuildManagerRolesHandlerConfig),
  HandlerConfigGroup.add(addGuildManagerRoleHandlerConfig),
  HandlerConfigGroup.add(removeGuildManagerRoleHandlerConfig),
  HandlerConfigGroup.add(setGuildChannelConfigHandlerConfig),
  HandlerConfigGroup.add(getGuildRunningChannelByIdHandlerConfig),
  HandlerConfigGroup.add(getGuildRunningChannelByNameHandlerConfig),
);

export const guildConfigHandlerGroup = pipe(
  HandlerGroup.empty(),
  HandlerGroup.add(getGuildConfigByGuildIdHandler),
  HandlerGroup.add(getGuildConfigByScriptIdHandler),
  HandlerGroup.add(upsertGuildConfigHandler),
  HandlerGroup.add(getGuildManagerRolesHandler),
  HandlerGroup.add(addGuildManagerRoleHandler),
  HandlerGroup.add(removeGuildManagerRoleHandler),
  HandlerGroup.add(setGuildChannelConfigHandler),
  HandlerGroup.add(getGuildRunningChannelByIdHandler),
  HandlerGroup.add(getGuildRunningChannelByNameHandler),
);
