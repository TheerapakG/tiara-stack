import { JSONSchema } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { GuildConfigManagerRole } from "./guildConfigManagerRole";

describe("GuildConfigManagerRole", () => {
  it("GuildConfigManagerRole generates json schema", () => {
    const schema = JSONSchema.make(GuildConfigManagerRole);
    expect(schema).toBeDefined();
  });
});
