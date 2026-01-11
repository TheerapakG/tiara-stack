import { pipe } from "effect";
import { Context } from "typhoon-server/handler";

import { addMessageCheckinMembersHandler } from "./addMessageCheckinMembers";
import { getMessageCheckinDataHandler } from "./getMessageCheckinData";
import { getMessageCheckinMembersHandler } from "./getMessageCheckinMembers";
import { removeMessageCheckinMemberHandler } from "./removeMessageCheckinMember";
import { setMessageCheckinMemberCheckinAtHandler } from "./setMessageCheckinMemberCheckinAt";
import { upsertMessageCheckinDataHandler } from "./upsertMessageCheckinData";

export const messageCheckinHandlerCollection = pipe(
  Context.Collection.empty(),
  Context.Collection.addSubscription(getMessageCheckinDataHandler),
  Context.Collection.addMutation(upsertMessageCheckinDataHandler),
  Context.Collection.addSubscription(getMessageCheckinMembersHandler),
  Context.Collection.addMutation(addMessageCheckinMembersHandler),
  Context.Collection.addMutation(setMessageCheckinMemberCheckinAtHandler),
  Context.Collection.addMutation(removeMessageCheckinMemberHandler),
);
