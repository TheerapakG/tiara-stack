import { Schema } from "effect";

const SessionData = {
  user: Schema.Struct({
    createdAt: Schema.DateTimeUtcFromMillis,
    updatedAt: Schema.DateTimeUtcFromMillis,
    email: Schema.String,
    emailVerified: Schema.Boolean,
    name: Schema.String,
    image: Schema.optional(Schema.NullOr(Schema.String)),
  }),
  session: Schema.UndefinedOr(
    Schema.Struct({
      createdAt: Schema.DateTimeUtcFromMillis,
      updatedAt: Schema.DateTimeUtcFromMillis,
      userId: Schema.String,
      expiresAt: Schema.DateTimeUtcFromMillis,
      token: Schema.String,
      ipAddress: Schema.optional(Schema.NullOr(Schema.String)),
      userAgent: Schema.optional(Schema.NullOr(Schema.String)),
    }),
  ),
  token: Schema.UndefinedOr(Schema.Redacted(Schema.String)),
};

export class Session extends Schema.TaggedClass<Session>()("Session", SessionData) {}
