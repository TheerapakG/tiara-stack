import { Schema } from "effect";
import type {
  ReadonlyJSONValue as ZeroReadonlyJSONValue,
  ReadonlyJSONObject as ZeroReadonlyJSONObject,
} from "@rocicorp/zero";

export const ReadonlyJSONValue = Schema.Union([
  Schema.Null,
  Schema.String,
  Schema.Boolean,
  Schema.Number,
  Schema.Array(
    Schema.suspend((): Schema.Codec<ZeroReadonlyJSONValue> => ReadonlyJSONValue).annotate({
      identifier: "ReadonlyJSONValue",
    }),
  ),
  Schema.suspend((): Schema.Codec<ZeroReadonlyJSONObject> => ReadonlyJSONObject).annotate({
    identifier: "ReadonlyJSONObject",
  }),
]);

const ReadonlyJSONObject = Schema.Record(
  Schema.String,
  Schema.UndefinedOr(
    Schema.suspend((): Schema.Codec<ZeroReadonlyJSONValue> => ReadonlyJSONValue).annotate({
      identifier: "ReadonlyJSONValue",
    }),
  ),
);
