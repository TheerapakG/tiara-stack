import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "@effect/platform";
import { Schema } from "effect";
import { ValidationError, QueryResultError } from "typhoon-core/error";
import { MessageCheckin, MessageCheckinMember } from "@/schemas/messageCheckin";

export class MessageCheckinApi extends HttpApiGroup.make("messageCheckin")
  .add(
    HttpApiEndpoint.get("getMessageCheckinData", "/messageCheckin/getMessageCheckinData")
      .setUrlParams(
        Schema.Struct({
          messageId: Schema.String,
        }),
      )
      .addSuccess(Schema.OptionFromNullishOr(MessageCheckin, undefined))
      .addError(Schema.Union(ValidationError, QueryResultError)),
  )
  .add(
    HttpApiEndpoint.post("upsertMessageCheckinData", "/messageCheckin/upsertMessageCheckinData")
      .setPayload(
        Schema.Struct({
          messageId: Schema.String,
          initialMessage: Schema.String,
          hour: Schema.Number,
          channelId: Schema.String,
          roleId: Schema.optionalWith(Schema.String, { nullable: true }),
        }),
      )
      .addSuccess(MessageCheckin)
      .addError(Schema.Union(ValidationError, QueryResultError)),
  )
  .add(
    HttpApiEndpoint.get("getMessageCheckinMembers", "/messageCheckin/getMessageCheckinMembers")
      .setUrlParams(
        Schema.Struct({
          messageId: Schema.String,
        }),
      )
      .addSuccess(Schema.Array(MessageCheckinMember))
      .addError(Schema.Union(ValidationError, QueryResultError)),
  )
  .add(
    HttpApiEndpoint.post("addMessageCheckinMembers", "/messageCheckin/addMessageCheckinMembers")
      .setPayload(
        Schema.Struct({
          messageId: Schema.String,
          memberIds: Schema.Array(Schema.String),
        }),
      )
      .addSuccess(Schema.Array(MessageCheckinMember))
      .addError(Schema.Union(ValidationError, QueryResultError)),
  )
  .add(
    HttpApiEndpoint.post(
      "setMessageCheckinMemberCheckinAt",
      "/messageCheckin/setMessageCheckinMemberCheckinAt",
    )
      .setPayload(
        Schema.Struct({
          messageId: Schema.String,
          memberId: Schema.String,
          checkinAt: Schema.Number,
        }),
      )
      .addSuccess(MessageCheckinMember)
      .addError(Schema.Union(ValidationError, QueryResultError)),
  )
  .add(
    HttpApiEndpoint.post("removeMessageCheckinMember", "/messageCheckin/removeMessageCheckinMember")
      .setPayload(
        Schema.Struct({
          messageId: Schema.String,
          memberId: Schema.String,
        }),
      )
      .addSuccess(MessageCheckinMember)
      .addError(Schema.Union(ValidationError, QueryResultError)),
  )
  .annotate(OpenApi.Title, "Message Checkin")
  .annotate(OpenApi.Description, "Message check-in endpoints") {}
