import { Schema } from "effect";
import { createSubjects } from "@openauthjs/openauth/subject";
import type { StandardSchemaV1 } from "@standard-schema/spec";

const userSubjectSchema: StandardSchemaV1<{
  discordAccessToken?: string;
  discordUserId: string;
}> = Schema.Struct({
  discordAccessToken: Schema.optional(Schema.String),
  discordUserId: Schema.String,
}).pipe(Schema.standardSchemaV1);

export const subjects = createSubjects({
  user: userSubjectSchema,
});
