import { Schema } from "effect";
import { describe, expect, it } from "@effect/vitest";
import {
  TeamTagsConstantsConfig,
  TeamTagsRangesConfig,
  TeamIsvSplitConfig,
  TeamIsvCombinedConfig,
  TeamConfig,
} from "./teamConfig";

describe("TeamTagsConstantsConfig", () => {
  it("TeamTagsConstantsConfig generates json schema", () => {
    const schema = Schema.toJsonSchemaDocument(TeamTagsConstantsConfig);
    expect(schema).toBeDefined();
  });
});

describe("TeamTagsRangesConfig", () => {
  it("TeamTagsRangesConfig generates json schema", () => {
    const schema = Schema.toJsonSchemaDocument(TeamTagsRangesConfig);
    expect(schema).toBeDefined();
  });
});

describe("TeamIsvSplitConfig", () => {
  it("TeamIsvSplitConfig generates json schema", () => {
    const schema = Schema.toJsonSchemaDocument(TeamIsvSplitConfig);
    expect(schema).toBeDefined();
  });
});

describe("TeamIsvCombinedConfig", () => {
  it("TeamIsvCombinedConfig generates json schema", () => {
    const schema = Schema.toJsonSchemaDocument(TeamIsvCombinedConfig);
    expect(schema).toBeDefined();
  });
});

describe("TeamConfig", () => {
  it("TeamConfig generates json schema", () => {
    const schema = Schema.toJsonSchemaDocument(TeamConfig);
    expect(schema).toBeDefined();
  });
});
