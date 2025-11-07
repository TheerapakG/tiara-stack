import { pipe } from "effect";
import { Handler } from "typhoon-core/server";

import { addGuildManagerRoleHandlerConfig } from "./addGuildManagerRole";
import { getGuildConfigByGuildIdHandlerConfig } from "./getGuildConfigByGuildId";
import { getGuildConfigByScriptIdHandlerConfig } from "./getGuildConfigByScriptId";
import { getGuildManagerRolesHandlerConfig } from "./getGuildManagerRoles";
import { getGuildRunningChannelByIdHandlerConfig } from "./getGuildRunningChannelById";
import { getGuildRunningChannelByNameHandlerConfig } from "./getGuildRunningChannelByName";
import { getAutoCheckinGuildsHandlerConfig } from "./getAutoCheckinGuilds";
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
  getAutoCheckinGuildsHandlerConfig,
};

export const guildConfigHandlerConfigCollection = pipe(
  Handler.Config.Collection.empty(),
  Handler.Config.Collection.add(getGuildConfigByGuildIdHandlerConfig),
  Handler.Config.Collection.add(getGuildConfigByScriptIdHandlerConfig),
  Handler.Config.Collection.add(upsertGuildConfigHandlerConfig),
  Handler.Config.Collection.add(getGuildManagerRolesHandlerConfig),
  Handler.Config.Collection.add(addGuildManagerRoleHandlerConfig),
  Handler.Config.Collection.add(removeGuildManagerRoleHandlerConfig),
  Handler.Config.Collection.add(upsertGuildChannelConfigHandlerConfig),
  Handler.Config.Collection.add(getGuildRunningChannelByIdHandlerConfig),
  Handler.Config.Collection.add(getGuildRunningChannelByNameHandlerConfig),
  Handler.Config.Collection.add(getAutoCheckinGuildsHandlerConfig),
);
