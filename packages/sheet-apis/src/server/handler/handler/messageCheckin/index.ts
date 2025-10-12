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
  Context.Collection.add(getMessageCheckinDataHandler),
  Context.Collection.add(upsertMessageCheckinDataHandler),
  Context.Collection.add(getMessageCheckinMembersHandler),
  Context.Collection.add(addMessageCheckinMembersHandler),
  Context.Collection.add(setMessageCheckinMemberCheckinAtHandler),
  Context.Collection.add(removeMessageCheckinMemberHandler),
);
