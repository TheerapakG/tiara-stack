import { describe, expect, it } from "vitest";
import { Api, SheetApisApi } from "./api";
import { DispatchRoomOrderButtonMethods, SheetApisRpcs } from "./sheet-apis-rpc";

const roomOrderButtonMethods = Object.values(DispatchRoomOrderButtonMethods);

describe("Api", () => {
  it("keeps sheet-apis health endpoints off ingress", () => {
    expect(SheetApisApi.groups).toHaveProperty("health");
    expect(Api.groups).not.toHaveProperty("health");
  });

  it("exposes every non-health sheet API group on ingress", () => {
    const sheetApiGroups = Object.keys(SheetApisApi.groups).filter((group) => group !== "health");

    for (const group of sheetApiGroups) {
      expect(Api.groups).toHaveProperty(group);
    }
  });

  it("splits room-order button RPCs by action", () => {
    expect(SheetApisRpcs.requests.has("dispatch.checkin")).toBe(true);
    expect(SheetApisRpcs.requests.has("dispatch.checkinButton")).toBe(true);
    expect(SheetApisRpcs.requests.has("dispatch.roomOrder")).toBe(true);
    for (const method of roomOrderButtonMethods) {
      expect(SheetApisRpcs.requests.has(method.rpcTag)).toBe(true);
    }
    expect(SheetApisRpcs.requests.has("checkin.dispatch")).toBe(false);
    expect(SheetApisRpcs.requests.has("checkin.handleButton")).toBe(false);
    expect(SheetApisRpcs.requests.has("roomOrder.dispatch")).toBe(false);
    expect(SheetApisRpcs.requests.has("roomOrder.handleButton")).toBe(false);
  });

  it("keeps split room-order button HTTP endpoint paths aligned with RPC names", () => {
    expect(SheetApisApi.groups).toHaveProperty("dispatch");
    expect(Api.groups).toHaveProperty("dispatch");

    for (const method of roomOrderButtonMethods) {
      expect(SheetApisRpcs.requests.has(method.rpcTag)).toBe(true);
      expect(SheetApisApi.groups.dispatch.endpoints[method.endpointName]).toMatchObject({
        method: "POST",
        name: method.endpointName,
        path: method.path,
      });
      expect(Api.groups.dispatch.endpoints[method.endpointName]).toMatchObject({
        method: "POST",
        name: method.endpointName,
        path: method.path,
      });
    }

    expect(SheetApisApi.groups.checkin.endpoints).not.toHaveProperty("dispatch");
    expect(SheetApisApi.groups.checkin.endpoints).not.toHaveProperty("handleButton");
    expect(SheetApisApi.groups.roomOrder.endpoints).not.toHaveProperty("dispatch");
    expect(SheetApisApi.groups.roomOrder.endpoints).not.toHaveProperty("handleButton");
    expect(Api.groups.checkin.endpoints).not.toHaveProperty("dispatch");
    expect(Api.groups.checkin.endpoints).not.toHaveProperty("handleButton");
    expect(Api.groups.roomOrder.endpoints).not.toHaveProperty("dispatch");
    expect(Api.groups.roomOrder.endpoints).not.toHaveProperty("handleButton");
  });
});
