import { describe, expect, it } from "vitest";
import { Schema } from "effect";
import { Api, SheetApisApi, SheetClusterApi } from "./api";
import { DispatchAcceptedResult } from "./handlers/dispatch/schema";
import { SheetClusterRpcs } from "./sheet-cluster-rpc";
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

  it("keeps dispatch RPCs on sheet-cluster only", () => {
    expect(SheetApisRpcs.requests.has("dispatch.checkin")).toBe(false);
    expect(SheetApisRpcs.requests.has("dispatch.checkinButton")).toBe(false);
    expect(SheetApisRpcs.requests.has("dispatch.roomOrder")).toBe(false);
    expect(SheetApisRpcs.requests.has("dispatch.kickout")).toBe(false);
    expect(SheetApisRpcs.requests.has("dispatch.slotButton")).toBe(false);
    expect(SheetApisRpcs.requests.has("dispatch.slotList")).toBe(false);
    expect(SheetApisRpcs.requests.has("dispatch.slotOpenButton")).toBe(false);
    expect(SheetApisRpcs.requests.has("dispatch.guildWelcome")).toBe(false);
    expect(SheetClusterRpcs.requests.has("dispatch.checkin")).toBe(true);
    expect(SheetClusterRpcs.requests.has("dispatch.checkinDiscard")).toBe(true);
    expect(SheetClusterRpcs.requests.has("dispatch.checkinButton")).toBe(true);
    expect(SheetClusterRpcs.requests.has("dispatch.checkinButtonDiscard")).toBe(true);
    expect(SheetClusterRpcs.requests.has("dispatch.roomOrder")).toBe(true);
    expect(SheetClusterRpcs.requests.has("dispatch.roomOrderDiscard")).toBe(true);
    expect(SheetClusterRpcs.requests.has("dispatch.kickout")).toBe(true);
    expect(SheetClusterRpcs.requests.has("dispatch.kickoutDiscard")).toBe(true);
    expect(SheetClusterRpcs.requests.has("dispatch.slotButton")).toBe(true);
    expect(SheetClusterRpcs.requests.has("dispatch.slotButtonDiscard")).toBe(true);
    expect(SheetClusterRpcs.requests.has("dispatch.slotList")).toBe(true);
    expect(SheetClusterRpcs.requests.has("dispatch.slotListDiscard")).toBe(true);
    expect(SheetClusterRpcs.requests.has("dispatch.slotOpenButton")).toBe(true);
    expect(SheetClusterRpcs.requests.has("dispatch.slotOpenButtonDiscard")).toBe(true);
    expect(SheetClusterRpcs.requests.has("dispatch.serviceStatus")).toBe(true);
    expect(SheetClusterRpcs.requests.has("dispatch.serviceStatusDiscard")).toBe(true);
    expect(SheetClusterRpcs.requests.has("dispatch.guildWelcome")).toBe(true);
    expect(SheetClusterRpcs.requests.has("dispatch.guildWelcomeDiscard")).toBe(true);
    expect(SheetApisRpcs.requests.has("status.getServices")).toBe(true);
    for (const method of roomOrderButtonMethods) {
      expect(SheetApisRpcs.requests.has(method.rpcTag)).toBe(false);
      expect(SheetClusterRpcs.requests.has(method.rpcTag)).toBe(true);
      expect(SheetClusterRpcs.requests.has(`${method.rpcTag}Discard`)).toBe(true);
    }
    expect(SheetApisRpcs.requests.has("checkin.dispatch")).toBe(false);
    expect(SheetApisRpcs.requests.has("checkin.handleButton")).toBe(false);
    expect(SheetApisRpcs.requests.has("roomOrder.dispatch")).toBe(false);
    expect(SheetApisRpcs.requests.has("roomOrder.handleButton")).toBe(false);
  });

  it("keeps split room-order button HTTP endpoint paths aligned with RPC names", () => {
    expect(SheetApisApi.groups).not.toHaveProperty("dispatch");
    expect(SheetClusterApi.groups).toHaveProperty("dispatch");
    expect(Api.groups).toHaveProperty("dispatch");

    for (const method of roomOrderButtonMethods) {
      expect(SheetClusterRpcs.requests.has(method.rpcTag)).toBe(true);
      expect(SheetClusterApi.groups.dispatch.endpoints[method.endpointName]).toMatchObject({
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

    expect(SheetClusterApi.groups.dispatch.endpoints.slotOpenButton).toMatchObject({
      method: "POST",
      name: "slotOpenButton",
      path: "/dispatch/slot/buttons/open",
    });
    expect(SheetClusterApi.groups.dispatch.endpoints.serviceStatus).toMatchObject({
      method: "POST",
      name: "serviceStatus",
      path: "/dispatch/status/services",
    });
    expect(SheetClusterApi.groups.dispatch.endpoints.guildWelcome).toMatchObject({
      method: "POST",
      name: "guildWelcome",
      path: "/dispatch/guild/welcome",
    });
    expect(Api.groups.dispatch.endpoints.slotOpenButton).toMatchObject({
      method: "POST",
      name: "slotOpenButton",
      path: "/dispatch/slot/buttons/open",
    });
    expect(Api.groups.dispatch.endpoints.serviceStatus).toMatchObject({
      method: "POST",
      name: "serviceStatus",
      path: "/dispatch/status/services",
    });
    expect(Api.groups.dispatch.endpoints.guildWelcome).toMatchObject({
      method: "POST",
      name: "guildWelcome",
      path: "/dispatch/guild/welcome",
    });

    expect(SheetApisApi.groups.checkin.endpoints).not.toHaveProperty("dispatch");
    expect(SheetApisApi.groups.checkin.endpoints).not.toHaveProperty("handleButton");
    expect(SheetApisApi.groups.roomOrder.endpoints).not.toHaveProperty("dispatch");
    expect(SheetApisApi.groups.roomOrder.endpoints).not.toHaveProperty("handleButton");
    expect(Api.groups.checkin.endpoints).not.toHaveProperty("dispatch");
    expect(Api.groups.checkin.endpoints).not.toHaveProperty("handleButton");
    expect(Api.groups.roomOrder.endpoints).not.toHaveProperty("dispatch");
    expect(Api.groups.roomOrder.endpoints).not.toHaveProperty("handleButton");
  });

  it("declares workflow discard RPCs as returning execution ids", () => {
    const discardRpc = SheetClusterRpcs.requests.get("dispatch.serviceStatusDiscard");

    expect(discardRpc).toBeDefined();
    expect(Schema.decodeUnknownSync(discardRpc!.successSchema)("execution-id")).toBe(
      "execution-id",
    );
    expect(() => Schema.decodeUnknownSync(discardRpc!.successSchema)(undefined)).toThrow();
  });

  it("accepts guild welcome dispatch results", () => {
    expect(
      Schema.decodeUnknownSync(DispatchAcceptedResult)({
        executionId: "guild-welcome-execution",
        operation: "guildWelcome",
        status: "accepted",
      }),
    ).toEqual({
      executionId: "guild-welcome-execution",
      operation: "guildWelcome",
      status: "accepted",
    });
  });

  it("keeps long interaction tokens out of ingress bot paths", () => {
    expect(Api.groups.ingressBot.endpoints.updateOriginalInteractionResponse).toMatchObject({
      method: "PATCH",
      name: "updateOriginalInteractionResponse",
      path: "/bot/interactions/original-response",
    });
    expect(
      Api.groups.ingressBot.endpoints.updateOriginalInteractionResponseWithFiles,
    ).toMatchObject({
      method: "PATCH",
      name: "updateOriginalInteractionResponseWithFiles",
      path: "/bot/interactions/original-response/files",
    });
  });
});
