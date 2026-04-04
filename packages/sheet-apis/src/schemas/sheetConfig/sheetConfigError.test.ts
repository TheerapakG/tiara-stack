import { Schema } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { SheetConfigError } from "./sheetConfigError";

describe("SheetConfigError", () => {
  it("SheetConfigError generates json schema", () => {
    const schema = Schema.toJsonSchemaDocument(SheetConfigError);
    expect(schema).toBeDefined();
  });
});
