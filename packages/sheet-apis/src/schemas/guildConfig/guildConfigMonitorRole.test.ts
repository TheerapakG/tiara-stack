import { Schema } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { GuildConfigMonitorRole } from "./guildConfigMonitorRole";

describe("GuildConfigMonitorRole", () => {
  it("GuildConfigMonitorRole generates json schema", () => {
    const schema = Schema.toJsonSchemaDocument(GuildConfigMonitorRole);
    expect(schema).toBeDefined();
  });
});
