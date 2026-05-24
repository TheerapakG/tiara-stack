import { describe, expect, it } from "vitest";
import { Exit, Schema } from "effect";
import { DiscordMember } from "./schema";

describe("Discord schema", () => {
  it("accepts guild member users without optional account flag fields", async () => {
    const member = {
      user: {
        id: "member-1",
        username: "member",
        avatar: null,
        discriminator: "0000",
        global_name: null,
        primary_guild: null,
      },
      nick: null,
      avatar: null,
      banner: null,
      roles: ["role-1"],
      premium_since: null,
      communication_disabled_until: null,
    };

    const result = Schema.decodeUnknownExit(DiscordMember)(member);

    expect(Exit.isSuccess(result)).toBe(true);
    expect(result).toMatchObject({
      value: {
        user: {
          id: "member-1",
        },
      },
    });
  });
});
