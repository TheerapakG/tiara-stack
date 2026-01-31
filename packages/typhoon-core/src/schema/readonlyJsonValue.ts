import { Schema } from "effect";
import type {
  ReadonlyJSONValue as ZeroReadonlyJSONValue,
  ReadonlyJSONObject as ZeroReadonlyJSONObject,
} from "@rocicorp/zero";

export const ReadonlyJSONValue = Schema.Union(
  Schema.Null,
  Schema.String,
  Schema.Boolean,
  Schema.Number,
  Schema.Array(
    Schema.suspend((): Schema.Schema<ZeroReadonlyJSONValue> => ReadonlyJSONValue).annotations({
      identifier: "ReadonlyJSONValue",
    }),
  ),
  Schema.suspend((): Schema.Schema<ZeroReadonlyJSONObject> => ReadonlyJSONObject).annotations({
    identifier: "ReadonlyJSONObject",
  }),
);

const ReadonlyJSONObject = Schema.Record({
  key: Schema.String,
  value: Schema.Union(
    Schema.suspend((): Schema.Schema<ZeroReadonlyJSONValue> => ReadonlyJSONValue).annotations({
      identifier: "ReadonlyJSONValue",
    }),
    Schema.Undefined,
  ),
});
