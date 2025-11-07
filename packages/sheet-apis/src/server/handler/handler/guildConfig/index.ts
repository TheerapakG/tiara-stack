import { pipe } from "effect";
import { Context } from "typhoon-server/handler";

import { addGuildManagerRoleHandler } from "./addGuildManagerRole";
import { getGuildConfigByGuildIdHandler } from "./getGuildConfigByGuildId";
import { getGuildConfigByScriptIdHandler } from "./getGuildConfigByScriptId";
import { getGuildManagerRolesHandler } from "./getGuildManagerRoles";
import { getGuildRunningChannelByIdHandler } from "./getGuildRunningChannelById";
import { getGuildRunningChannelByNameHandler } from "./getGuildRunningChannelByName";
import { getAutoCheckinGuildsHandler } from "./getAutoCheckinGuilds";
import { removeGuildManagerRoleHandler } from "./removeGuildManagerRole";
import { upsertGuildChannelConfigHandler } from "./upsertGuildChannelConfig";
import { upsertGuildConfigHandler } from "./upsertGuildConfig";

export const guildConfigHandlerCollection = pipe(
  Context.Collection.empty(),
  Context.Collection.add(getGuildConfigByGuildIdHandler),
  Context.Collection.add(getGuildConfigByScriptIdHandler),
  Context.Collection.add(upsertGuildConfigHandler),
  Context.Collection.add(getGuildManagerRolesHandler),
  Context.Collection.add(addGuildManagerRoleHandler),
  Context.Collection.add(removeGuildManagerRoleHandler),
  Context.Collection.add(upsertGuildChannelConfigHandler),
  Context.Collection.add(getGuildRunningChannelByIdHandler),
  Context.Collection.add(getGuildRunningChannelByNameHandler),
  Context.Collection.add(getAutoCheckinGuildsHandler),
);
