import {
  Array,
  Chunk,
  Effect,
  ParseResult,
  pipe,
  Schema,
  String,
} from "effect";
import { ArrayLookupSchema } from "../schema/arrayLookup";
import { KeyOrderLookupSchema } from "../schema/keyOrderLookup";

export const HeaderActionSchema = ArrayLookupSchema([
  "client:subscribe",
  "client:unsubscribe",
  "client:once",
  "client:mutate",
  "server:update",
]);

export const EmptyPayloadSchema = pipe(
  KeyOrderLookupSchema([], {}),
  Schema.transformOrFail(Schema.Unknown, {
    strict: true,
    decode: (value) => ParseResult.succeed(value),
    encode: (value) => pipe(value, ParseResult.decodeUnknown(Schema.Object)),
  }),
);

export const HandlerPayloadSchema = KeyOrderLookupSchema(["handler", "token"], {
  handler: Schema.String,
  token: Schema.optional(Schema.String),
});

export const SuccessTimestampPayloadSchema = KeyOrderLookupSchema(
  ["success", "timestamp"],
  {
    success: Schema.Boolean,
    timestamp: Schema.ValidDateFromSelf,
  },
);

export const BaseHeaderSchema = KeyOrderLookupSchema(
  ["protocol", "version", "id", "action", "payload"],
  {
    protocol: Schema.String,
    version: Schema.Number,
    id: pipe(
      Schema.Uint8ArrayFromSelf,
      Schema.transform(Schema.Array(Schema.Number), {
        strict: true,
        decode: Array.fromIterable,
        encode: (value) => new Uint8Array(value),
      }),
      Schema.itemsCount(16),
      Schema.transform(Schema.Array(Schema.String), {
        strict: true,
        decode: Array.map((v) => pipe(v.toString(16), String.padStart(2, "0"))),
        encode: Array.map((v) => parseInt(v, 16)),
      }),
      Schema.itemsCount(16),
      Schema.transform(Schema.UUID, {
        strict: true,
        decode: (value) =>
          `${value.slice(0, 4).join("")}-${value.slice(4, 6).join("")}-${value.slice(6, 8).join("")}-${value.slice(8, 10).join("")}-${value.slice(10).join("")}`,
        encode: (value) =>
          pipe(
            value,
            String.replaceAll("-", ""),
            Chunk.fromIterable,
            Chunk.chunksOf(2),
            Chunk.map(Chunk.join("")),
            Chunk.toReadonlyArray,
          ),
      }),
    ),
    action: HeaderActionSchema,
    payload: Schema.Array(Schema.Tuple(Schema.Number, Schema.Unknown)),
  },
);

export const ActionPayloadSchemas = {
  "client:subscribe": HandlerPayloadSchema,
  "client:once": HandlerPayloadSchema,
  "client:mutate": HandlerPayloadSchema,
  "server:update": SuccessTimestampPayloadSchema,
  "client:unsubscribe": EmptyPayloadSchema,
};

export type ActionPayload<
  Actions extends
    typeof HeaderActionSchema.Type = typeof HeaderActionSchema.Type,
> = {
  [action in Actions]: {
    action: action;
    payload: (typeof ActionPayloadSchemas)[action]["Type"];
  };
}[Actions];

export const ActionPayloadUnionMemberSchemas = pipe(
  HeaderActionSchema.to.literals,
  Array.map((literal) =>
    Schema.Struct({
      action: Schema.Literal(literal),
      payload: Schema.typeSchema(
        ActionPayloadSchemas[literal] as Schema.Schema<
          unknown,
          readonly (readonly [number, unknown])[],
          never
        >,
      ),
    }),
  ),
) as {
  [action in typeof HeaderActionSchema.Type]: Schema.Schema<
    ActionPayload<action>
  >;
}[typeof HeaderActionSchema.Type][];

export const ActionPayloadSchema = pipe(
  Schema.Struct({
    action: Schema.Literal(...HeaderActionSchema.to.literals),
    payload: Schema.Array(Schema.Tuple(Schema.Number, Schema.Unknown)),
  }),
  Schema.transformOrFail(Schema.Union(...ActionPayloadUnionMemberSchemas), {
    strict: true,
    decode: (value) =>
      pipe(
        value.payload,
        ParseResult.decode(
          ActionPayloadSchemas[value.action] as Schema.Schema<
            unknown,
            readonly (readonly [number, unknown])[],
            never
          >,
        ),
        Effect.map(
          (payload) =>
            ({
              action: value.action,
              payload,
            }) as ActionPayload,
        ),
      ),
    encode: (value) =>
      pipe(
        value.payload,
        ParseResult.encode(
          ActionPayloadSchemas[value.action] as Schema.Schema<
            unknown,
            readonly (readonly [number, unknown])[],
            never
          >,
        ),
        Effect.map((payload) => ({
          action: value.action,
          payload,
        })),
      ),
  }),
);

export type Header<
  Actions extends
    typeof HeaderActionSchema.Type = typeof HeaderActionSchema.Type,
> = {
  [action in Actions]: {
    protocol: string;
    version: number;
    id: string;
    action: action;
    payload: (typeof ActionPayloadSchemas)[action]["Type"];
  };
}[Actions];

export const HeaderUnionMemberSchemas = pipe(
  HeaderActionSchema.to.literals,
  Array.map((literal) =>
    Schema.Struct({
      protocol: Schema.String,
      version: Schema.Number,
      id: Schema.UUID,
      action: Schema.Literal(literal),
      payload: Schema.typeSchema(
        ActionPayloadSchemas[literal] as Schema.Schema<
          unknown,
          readonly (readonly [number, unknown])[],
          never
        >,
      ),
    }),
  ),
) as {
  [action in typeof HeaderActionSchema.Type]: Schema.Schema<Header<action>>;
}[typeof HeaderActionSchema.Type][];

export const HeaderSchema = pipe(
  BaseHeaderSchema,
  Schema.transformOrFail(Schema.Union(...HeaderUnionMemberSchemas), {
    strict: true,
    decode: (value) =>
      pipe(
        value,
        ParseResult.decode(ActionPayloadSchema),
        Effect.map((actionPayload) => ({
          ...value,
          ...actionPayload,
        })),
      ),
    encode: (value) =>
      pipe(
        value,
        ParseResult.encode(ActionPayloadSchema),
        Effect.map((actionPayload) => ({
          ...value,
          ...actionPayload,
        })),
      ),
  }),
);
