import { pipe } from "effect";
import { Data as HandlerData } from "typhoon-server/handler";

import { addMessageCheckinMembersHandlerData } from "./addMessageCheckinMembers";
import { getMessageCheckinDataHandlerData } from "./getMessageCheckinData";
import { getMessageCheckinMembersHandlerData } from "./getMessageCheckinMembers";
import { removeMessageCheckinMemberHandlerData } from "./removeMessageCheckinMember";
import { setMessageCheckinMemberCheckinAtHandlerData } from "./setMessageCheckinMemberCheckinAt";
import { upsertMessageCheckinDataHandlerData } from "./upsertMessageCheckinData";

export {
  addMessageCheckinMembersHandlerData,
  getMessageCheckinDataHandlerData,
  getMessageCheckinMembersHandlerData,
  removeMessageCheckinMemberHandlerData,
  setMessageCheckinMemberCheckinAtHandlerData,
  upsertMessageCheckinDataHandlerData,
};

export const messageCheckinHandlerDataCollection = pipe(
  HandlerData.Collection.empty(),
  HandlerData.Collection.addSubscription(getMessageCheckinDataHandlerData),
  HandlerData.Collection.addMutation(upsertMessageCheckinDataHandlerData),
  HandlerData.Collection.addSubscription(getMessageCheckinMembersHandlerData),
  HandlerData.Collection.addMutation(addMessageCheckinMembersHandlerData),
  HandlerData.Collection.addMutation(setMessageCheckinMemberCheckinAtHandlerData),
  HandlerData.Collection.addMutation(removeMessageCheckinMemberHandlerData),
);
