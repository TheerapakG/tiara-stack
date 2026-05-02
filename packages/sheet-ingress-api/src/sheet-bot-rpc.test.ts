import { describe, expect, it } from "vitest";
import { Exit, Schema } from "effect";
import { SheetBotDispatchRpcAuthorization } from "./middlewares/sheetBotDispatchRpcAuthorization/tag";
import { SheetBotRpcAuthorization } from "./middlewares/sheetBotRpcAuthorization/tag";
import { DispatchCheckinPayload, DispatchRoomOrderPayload, SheetBotRpcs } from "./sheet-bot-rpc";

describe("SheetBotRpcs", () => {
  it("keeps existing Discord RPC tags and adds dispatch tags", () => {
    expect(SheetBotRpcs.requests.has("application.getApplication")).toBe(true);
    expect(SheetBotRpcs.requests.has("cache.getMember")).toBe(true);
    expect(SheetBotRpcs.requests.has("dispatch.checkin")).toBe(true);
    expect(SheetBotRpcs.requests.has("dispatch.roomOrder")).toBe(true);
  });

  it("requires authorization middleware on clients", () => {
    expect(SheetBotRpcAuthorization.requiredForClient).toBe(true);
    expect(SheetBotDispatchRpcAuthorization.requiredForClient).toBe(true);
  });

  it("rejects target channel ids on dispatch payloads", () => {
    expect(
      Exit.isFailure(
        Schema.decodeUnknownExit(DispatchCheckinPayload)({
          guildId: "guild-1",
          channelName: "room-a",
          channelId: "target-channel",
        }),
      ),
    ).toBe(true);
    expect(
      Exit.isFailure(
        Schema.decodeUnknownExit(DispatchRoomOrderPayload)({
          guildId: "guild-1",
          channelName: "room-a",
          targetChannelId: "target-channel",
        }),
      ),
    ).toBe(true);
  });
});
