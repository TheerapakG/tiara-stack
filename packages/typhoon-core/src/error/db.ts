import { Schema } from "effect";

const DBQueryErrorData = Schema.Struct({
  message: Schema.String,
  cause: Schema.optionalWith(Schema.Unknown, { nullable: true }),
});
const DBQueryErrorTaggedError: Schema.TaggedErrorClass<
  DBQueryError,
  "DBQueryError",
  {
    readonly _tag: Schema.tag<"DBQueryError">;
  } & (typeof DBQueryErrorData)["fields"]
> = Schema.TaggedError<DBQueryError>()("DBQueryError", DBQueryErrorData);
export class DBQueryError extends DBQueryErrorTaggedError {}

export const makeDBQueryError = (message: string, cause?: unknown) =>
  new DBQueryError({ message, cause });
