import { describe, expect, it } from "vitest";
import { SheetApisRpcs } from "sheet-ingress-api/sheet-apis-rpc";

describe("SheetApisRpcs", () => {
  it("defines internal sheet API RPC tags", () => {
    expect(SheetApisRpcs.requests.has("health.live")).toBe(true);
    expect(SheetApisRpcs.requests.has("messageSlot.getMessageSlotData")).toBe(true);
    expect(SheetApisRpcs.requests.has("calc.calcSheet")).toBe(true);
  });
});
