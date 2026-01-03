import { pipe } from "effect";
import { Data as HandlerData } from "typhoon-server/handler";

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

export const messageCheckinHandlerDataCollection = pipe(
  HandlerData.Collection.empty(),
  HandlerData.Collection.addSubscription(getMessageCheckinDataHandlerConfig),
  HandlerData.Collection.addMutation(upsertMessageCheckinDataHandlerConfig),
  HandlerData.Collection.addSubscription(getMessageCheckinMembersHandlerConfig),
  HandlerData.Collection.addMutation(addMessageCheckinMembersHandlerConfig),
  HandlerData.Collection.addMutation(
    setMessageCheckinMemberCheckinAtHandlerConfig,
  ),
  HandlerData.Collection.addMutation(removeMessageCheckinMemberHandlerConfig),
);
