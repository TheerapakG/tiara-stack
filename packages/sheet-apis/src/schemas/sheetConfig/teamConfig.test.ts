import { JSONSchema } from "effect";
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
    const schema = JSONSchema.make(TeamTagsConstantsConfig);
    expect(schema).toBeDefined();
  });
});

describe("TeamTagsRangesConfig", () => {
  it("TeamTagsRangesConfig generates json schema", () => {
    const schema = JSONSchema.make(TeamTagsRangesConfig);
    expect(schema).toBeDefined();
  });
});

describe("TeamIsvSplitConfig", () => {
  it("TeamIsvSplitConfig generates json schema", () => {
    const schema = JSONSchema.make(TeamIsvSplitConfig);
    expect(schema).toBeDefined();
  });
});

describe("TeamIsvCombinedConfig", () => {
  it("TeamIsvCombinedConfig generates json schema", () => {
    const schema = JSONSchema.make(TeamIsvCombinedConfig);
    expect(schema).toBeDefined();
  });
});

describe("TeamConfig", () => {
  it("TeamConfig generates json schema", () => {
    const schema = JSONSchema.make(TeamConfig);
    expect(schema).toBeDefined();
  });
});
