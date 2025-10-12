import { pipe } from "effect";
import { Handler } from "typhoon-core/server";

import { addMessageCheckinMembersHandlerConfig } from "./addMessageCheckinMembers";
import { getMessageCheckinDataHandlerConfig } from "./getMessageCheckinData";
import { getMessageCheckinMembersHandlerConfig } from "./getMessageCheckinMembers";
import { removeMessageCheckinMemberHandlerConfig } from "./removeMessageCheckinMember";
import { setMessageCheckinMemberCheckinAtHandlerConfig } from "./setMessageCheckinMemberCheckinAt";
import { upsertMessageCheckinDataHandlerConfig } from "./upsertMessageCheckinData";

export {
  addMessageCheckinMembersHandlerConfig,
  getMessageCheckinDataHandlerConfig,
  getMessageCheckinMembersHandlerConfig,
  removeMessageCheckinMemberHandlerConfig,
  setMessageCheckinMemberCheckinAtHandlerConfig,
  upsertMessageCheckinDataHandlerConfig,
};

export const messageCheckinHandlerConfigCollection = pipe(
  Handler.Config.Collection.empty(),
  Handler.Config.Collection.add(getMessageCheckinDataHandlerConfig),
  Handler.Config.Collection.add(upsertMessageCheckinDataHandlerConfig),
  Handler.Config.Collection.add(getMessageCheckinMembersHandlerConfig),
  Handler.Config.Collection.add(addMessageCheckinMembersHandlerConfig),
  Handler.Config.Collection.add(setMessageCheckinMemberCheckinAtHandlerConfig),
  Handler.Config.Collection.add(removeMessageCheckinMemberHandlerConfig),
);
