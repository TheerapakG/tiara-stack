import { Rpc, RpcGroup } from "effect/unstable/rpc";
import { Schema } from "effect";
import { DiscordRpcs } from "dfx-discord-utils/discord/rpc";
import { ArgumentError, SchemaError, Unauthorized, UnknownError } from "typhoon-core/error";
import { QueryResultError } from "typhoon-zero/error";
import { SheetBotRpcAuthorization } from "./middlewares/sheetBotRpcAuthorization/tag";
import { SheetBotDispatchRpcAuthorization } from "./middlewares/sheetBotDispatchRpcAuthorization/tag";
import { GoogleSheetsError } from "./schemas/google";
import { ParserFieldError } from "./schemas/sheet/error";
import { SheetConfigError } from "./schemas/sheetConfig";

export const SheetBotDispatchError = Schema.Union([
  GoogleSheetsError,
  ParserFieldError,
  SheetConfigError,
  SchemaError,
  QueryResultError,
  ArgumentError,
  Unauthorized,
  UnknownError,
]);

export type SheetBotDispatchError = Schema.Schema.Type<typeof SheetBotDispatchError>;

export const DispatchCheckinError = SheetBotDispatchError;

export type DispatchCheckinError = Schema.Schema.Type<typeof DispatchCheckinError>;

export const DispatchRoomOrderError = SheetBotDispatchError;

export type DispatchRoomOrderError = Schema.Schema.Type<typeof DispatchRoomOrderError>;

export const DispatchCheckinPayload = Schema.Struct({
  guildId: Schema.String,
  channelName: Schema.String,
  hour: Schema.optional(Schema.Number),
  template: Schema.optional(Schema.String),
  interactionToken: Schema.optional(Schema.String),
  channelId: Schema.optional(Schema.Never),
  targetChannelId: Schema.optional(Schema.Never),
});

export type DispatchCheckinPayload = Schema.Schema.Type<typeof DispatchCheckinPayload>;

export const DispatchCheckinResult = Schema.Struct({
  hour: Schema.Number,
  runningChannelId: Schema.String,
  checkinChannelId: Schema.String,
  checkinMessageId: Schema.NullOr(Schema.String),
  checkinMessageChannelId: Schema.NullOr(Schema.String),
  primaryMessageId: Schema.String,
  primaryMessageChannelId: Schema.String,
  tentativeRoomOrderMessageId: Schema.NullOr(Schema.String),
  tentativeRoomOrderMessageChannelId: Schema.NullOr(Schema.String),
});

export type DispatchCheckinResult = Schema.Schema.Type<typeof DispatchCheckinResult>;

export const DispatchRoomOrderPayload = Schema.Struct({
  guildId: Schema.String,
  channelName: Schema.String,
  hour: Schema.optional(Schema.Number),
  healNeeded: Schema.optional(Schema.Number),
  interactionToken: Schema.optional(Schema.String),
  channelId: Schema.optional(Schema.Never),
  targetChannelId: Schema.optional(Schema.Never),
});

export type DispatchRoomOrderPayload = Schema.Schema.Type<typeof DispatchRoomOrderPayload>;

export const DispatchRoomOrderResult = Schema.Struct({
  messageId: Schema.String,
  messageChannelId: Schema.String,
  hour: Schema.Number,
  runningChannelId: Schema.String,
  rank: Schema.Number,
});

export type DispatchRoomOrderResult = Schema.Schema.Type<typeof DispatchRoomOrderResult>;

const SheetBotDispatchRpcsBase = RpcGroup.make(
  Rpc.make("dispatch.checkin", {
    payload: Schema.Struct({
      payload: DispatchCheckinPayload,
    }),
    success: DispatchCheckinResult,
    error: DispatchCheckinError,
  }),
  Rpc.make("dispatch.roomOrder", {
    payload: Schema.Struct({
      payload: DispatchRoomOrderPayload,
    }),
    success: DispatchRoomOrderResult,
    error: DispatchRoomOrderError,
  }),
);

export const SheetBotDispatchRpcs = SheetBotDispatchRpcsBase.middleware(
  SheetBotDispatchRpcAuthorization,
);

export const SheetBotRpcs =
  DiscordRpcs.middleware(SheetBotRpcAuthorization).merge(SheetBotDispatchRpcs);
