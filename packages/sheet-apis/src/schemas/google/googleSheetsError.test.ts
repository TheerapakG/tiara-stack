import { JSONSchema } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { GoogleSheetsError } from "./googleSheetsError";

describe("GoogleSheetsError", () => {
  it("GoogleSheetsError generates json schema", () => {
    const schema = JSONSchema.make(GoogleSheetsError);
    expect(schema).toBeDefined();
  });
});
