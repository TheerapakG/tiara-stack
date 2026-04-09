import { Effect, Schema, SchemaGetter, SchemaParser } from "effect";
import { SchemaIssue, SchemaIssueStruct } from "./schemaIssue";

type SchemaErrorStruct = {
  _tag: "SchemaError";
  issue: Schema.Schema.Type<typeof SchemaIssueStruct>;
  message: string;
};

const SchemaErrorStruct = Schema.TaggedStruct("SchemaError", {
  issue: SchemaIssueStruct,
  message: Schema.String,
});

const SchemaErrorDeclare = Schema.declare(
  (input): input is Schema.SchemaError => input instanceof Schema.SchemaError,
);

export const SchemaError: Schema.Codec<Schema.SchemaError, SchemaErrorStruct> =
  SchemaErrorStruct.pipe(
    Schema.decodeTo(SchemaErrorDeclare, {
      decode: SchemaGetter.transformOrFail(
        Effect.fnUntraced(function* ({ issue }) {
          const decodedIssue = yield* SchemaParser.decodeUnknownEffect(SchemaIssue)(issue);
          return new Schema.SchemaError(decodedIssue);
        }),
      ),
      encode: SchemaGetter.transformOrFail(
        Effect.fnUntraced(function* ({ issue, message }) {
          const encodedIssue = yield* SchemaParser.encodeUnknownEffect(SchemaIssue)(issue);
          return {
            _tag: "SchemaError",
            issue: encodedIssue,
            message,
          };
        }),
      ),
    }),
  );
