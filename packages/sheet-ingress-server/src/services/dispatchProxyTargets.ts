import { DispatchRoomOrderButtonMethods } from "sheet-ingress-api/sheet-apis-rpc";

export const dispatchProxyTargets = {
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
} as const;
