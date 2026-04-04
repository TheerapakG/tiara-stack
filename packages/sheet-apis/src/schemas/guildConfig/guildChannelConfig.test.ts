import { Schema } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { GuildChannelConfig } from "./guildChannelConfig";

describe("GuildChannelConfig", () => {
  it("GuildChannelConfig generates json schema", () => {
    const schema = Schema.toJsonSchemaDocument(GuildChannelConfig);
    expect(schema).toBeDefined();
  });
});
