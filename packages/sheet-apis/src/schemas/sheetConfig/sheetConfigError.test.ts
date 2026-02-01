import { JSONSchema } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { SheetConfigError } from "./sheetConfigError";

describe("SheetConfigError", () => {
  it("SheetConfigError generates json schema", () => {
    const schema = JSONSchema.make(SheetConfigError);
    expect(schema).toBeDefined();
  });
});
