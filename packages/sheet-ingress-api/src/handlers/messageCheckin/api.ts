import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi";
import { Schema } from "effect";
import { SchemaError, ArgumentError } from "typhoon-core/error";
import { QueryResultError } from "typhoon-zero/error";
import { MessageCheckin, MessageCheckinMember } from "../../schemas/messageCheckin";
import { SheetAuthTokenAuthorization } from "../../middlewares/sheetAuthTokenAuthorization/tag";

export class MessageCheckinApi extends HttpApiGroup.make("messageCheckin")
  .add(
    HttpApiEndpoint.get("getMessageCheckinData", "/messageCheckin/getMessageCheckinData", {
      query: Schema.Struct({
        messageId: Schema.String,
      }),
      success: MessageCheckin,
      error: [SchemaError, QueryResultError, ArgumentError],
    }),
  )
  .add(
    HttpApiEndpoint.post("upsertMessageCheckinData", "/messageCheckin/upsertMessageCheckinData", {
      payload: Schema.Struct({
        messageId: Schema.String,
        data: Schema.Struct({
          initialMessage: Schema.String,
          hour: Schema.Number,
          channelId: Schema.String,
          roleId: Schema.optional(Schema.NullOr(Schema.String)),
          guildId: Schema.NullOr(Schema.String),
          messageChannelId: Schema.NullOr(Schema.String),
          createdByUserId: Schema.NullOr(Schema.String),
        }),
      }),
      success: MessageCheckin,
      error: [SchemaError, QueryResultError],
    }),
  )
  .add(
    HttpApiEndpoint.get("getMessageCheckinMembers", "/messageCheckin/getMessageCheckinMembers", {
      query: Schema.Struct({
        messageId: Schema.String,
      }),
      success: Schema.Array(MessageCheckinMember),
      error: [SchemaError, QueryResultError, ArgumentError],
    }),
  )
  .add(
    HttpApiEndpoint.post("addMessageCheckinMembers", "/messageCheckin/addMessageCheckinMembers", {
      payload: Schema.Struct({
        messageId: Schema.String,
        memberIds: Schema.Array(Schema.String),
      }),
      success: Schema.Array(MessageCheckinMember),
      error: [SchemaError, QueryResultError, ArgumentError],
    }),
  )
  .add(
    HttpApiEndpoint.post(
      "setMessageCheckinMemberCheckinAt",
      "/messageCheckin/setMessageCheckinMemberCheckinAt",
      {
        payload: Schema.Struct({
          messageId: Schema.String,
          memberId: Schema.String,
          checkinAt: Schema.Number,
        }),
        success: MessageCheckinMember,
        error: [SchemaError, QueryResultError, ArgumentError],
      },
    ),
  )
  .add(
    HttpApiEndpoint.post(
      "removeMessageCheckinMember",
      "/messageCheckin/removeMessageCheckinMember",
      {
        payload: Schema.Struct({
          messageId: Schema.String,
          memberId: Schema.String,
        }),
        success: MessageCheckinMember,
        error: [SchemaError, QueryResultError, ArgumentError],
      },
    ),
  )
  .middleware(SheetAuthTokenAuthorization)
  .annotate(OpenApi.Title, "Message Checkin")
  .annotate(OpenApi.Description, "Message check-in endpoints") {}
