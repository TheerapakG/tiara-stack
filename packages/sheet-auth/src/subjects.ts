import { Schema } from "effect";
import { createSubjects } from "@openauthjs/openauth/subject";

const discordGuildSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  icon: Schema.NullOr(Schema.String),
  owner: Schema.Boolean,
  permissions: Schema.String,
  features: Schema.Array(Schema.String),
});

const userSubjectSchema = Schema.Struct({
  discordUserId: Schema.String,
  discordGuilds: Schema.NullOr(Schema.Array(discordGuildSchema)),
}).pipe(Schema.standardSchemaV1);

export const subjects = createSubjects({
  user: userSubjectSchema,
});

export type UserSubject = Schema.Schema.Type<typeof userSubjectSchema>;
