import { JSONSchema } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { GuildConfigMonitorRole } from "./guildConfigMonitorRole";

describe("GuildConfigMonitorRole", () => {
  it("GuildConfigMonitorRole generates json schema", () => {
    const schema = JSONSchema.make(GuildConfigMonitorRole);
    expect(schema).toBeDefined();
  });
});
