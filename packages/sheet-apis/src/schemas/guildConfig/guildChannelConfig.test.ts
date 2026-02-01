import { JSONSchema } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { GuildChannelConfig } from "./guildChannelConfig";

describe("GuildChannelConfig", () => {
  it("GuildChannelConfig generates json schema", () => {
    const schema = JSONSchema.make(GuildChannelConfig);
    expect(schema).toBeDefined();
  });
});
