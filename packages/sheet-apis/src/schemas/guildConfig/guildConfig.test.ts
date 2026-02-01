import { JSONSchema } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { GuildConfig } from "./guildConfig";

describe("GuildConfig", () => {
  it("GuildConfig generates json schema", () => {
    const schema = JSONSchema.make(GuildConfig);
    expect(schema).toBeDefined();
  });
});
