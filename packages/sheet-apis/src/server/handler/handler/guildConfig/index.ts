import { pipe } from "effect";
import { Context } from "typhoon-server/handler";

import { addGuildManagerRoleHandler } from "./addGuildManagerRole";
import { getGuildConfigByGuildIdHandler } from "./getGuildConfigByGuildId";
import { getGuildConfigByScriptIdHandler } from "./getGuildConfigByScriptId";
import { getGuildManagerRolesHandler } from "./getGuildManagerRoles";
import { getGuildRunningChannelByIdHandler } from "./getGuildRunningChannelById";
import { getGuildRunningChannelByNameHandler } from "./getGuildRunningChannelByName";
import { removeGuildManagerRoleHandler } from "./removeGuildManagerRole";
import { upsertGuildChannelConfigHandler } from "./upsertGuildChannelConfig";
import { upsertGuildConfigHandler } from "./upsertGuildConfig";
import { getAutoCheckinGuildsHandler } from "./getAutoCheckinGuilds";

export const guildConfigHandlerCollection = pipe(
  Context.Collection.empty(),
  Context.Collection.addSubscription(getGuildConfigByGuildIdHandler),
  Context.Collection.addSubscription(getGuildConfigByScriptIdHandler),
  Context.Collection.addMutation(upsertGuildConfigHandler),
  Context.Collection.addSubscription(getGuildManagerRolesHandler),
  Context.Collection.addMutation(addGuildManagerRoleHandler),
  Context.Collection.addMutation(removeGuildManagerRoleHandler),
  Context.Collection.addMutation(upsertGuildChannelConfigHandler),
  Context.Collection.addSubscription(getGuildRunningChannelByIdHandler),
  Context.Collection.addSubscription(getGuildRunningChannelByNameHandler),
  Context.Collection.addSubscription(getAutoCheckinGuildsHandler),
);
