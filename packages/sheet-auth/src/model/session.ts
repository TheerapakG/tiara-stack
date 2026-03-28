import { Schema } from "effect";

const SessionData = {
  user: Schema.Struct({
    createdAt: Schema.DateTimeUtcFromNumber,
    updatedAt: Schema.DateTimeUtcFromNumber,
    email: Schema.String,
    emailVerified: Schema.Boolean,
    name: Schema.String,
    image: Schema.optional(Schema.NullOr(Schema.String)),
  }),
  session: Schema.UndefinedOr(
    Schema.Struct({
      createdAt: Schema.DateTimeUtcFromNumber,
      updatedAt: Schema.DateTimeUtcFromNumber,
      userId: Schema.String,
      expiresAt: Schema.DateTimeUtcFromNumber,
      token: Schema.String,
      ipAddress: Schema.optional(Schema.NullOr(Schema.String)),
      userAgent: Schema.optional(Schema.NullOr(Schema.String)),
    }),
  ),
  token: Schema.UndefinedOr(Schema.Redacted(Schema.String)),
};

const SessionTaggedClass: Schema.TaggedClass<
  Session,
  "Session",
  {
    readonly _tag: Schema.tag<"Session">;
  } & {
    readonly [K in keyof typeof SessionData]: (typeof SessionData)[K];
  }
> = Schema.TaggedClass<Session>()("Session", SessionData);

export class Session extends SessionTaggedClass {}
