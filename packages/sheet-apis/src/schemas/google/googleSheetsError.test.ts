import { Schema } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { GoogleSheetsError } from "./googleSheetsError";

describe("GoogleSheetsError", () => {
  it("GoogleSheetsError generates json schema", () => {
    const schema = Schema.toJsonSchemaDocument(GoogleSheetsError);
    expect(schema).toBeDefined();
  });
});
