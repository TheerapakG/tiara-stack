import { describe, expect, it } from "vitest";
import { DispatchRoomOrderButtonMethods } from "sheet-ingress-api/sheet-apis-rpc";
import { dispatchProxyTargets } from "./dispatchProxyTargets";

describe("dispatch proxy targets", () => {
  it("maps dispatch API endpoints to dispatch forwarding methods", () => {
    expect(dispatchProxyTargets).toEqual({
      checkin: {
        group: "dispatch",
        endpoint: "checkin",
      },
      checkinButton: {
        group: "dispatch",
        endpoint: "checkinButton",
      },
      roomOrder: {
        group: "dispatch",
        endpoint: "roomOrder",
      },
      roomOrderPreviousButton: {
        group: "dispatch",
        endpoint: DispatchRoomOrderButtonMethods.previous.endpointName,
      },
      roomOrderNextButton: {
        group: "dispatch",
        endpoint: DispatchRoomOrderButtonMethods.next.endpointName,
      },
      roomOrderSendButton: {
        group: "dispatch",
        endpoint: DispatchRoomOrderButtonMethods.send.endpointName,
      },
      roomOrderPinTentativeButton: {
        group: "dispatch",
        endpoint: DispatchRoomOrderButtonMethods.pinTentative.endpointName,
      },
    });
  });
});
