import { Schema } from "effect";
import { createSubjects } from "@openauthjs/openauth/subject";

const userSubjectSchema = Schema.Struct({
  discordUserId: Schema.String,
}).pipe(Schema.standardSchemaV1);

export const subjects = createSubjects({
  user: userSubjectSchema,
});

export type UserSubject = Schema.Schema.Type<typeof userSubjectSchema>;
