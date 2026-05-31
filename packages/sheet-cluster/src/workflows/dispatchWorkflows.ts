import { ClusterSchema } from "effect/unstable/cluster";
import {
  DispatchCheckinButtonWorkflow as BaseDispatchCheckinButtonWorkflow,
  DispatchCheckinWorkflow as BaseDispatchCheckinWorkflow,
  DispatchGuildWelcomeWorkflow as BaseDispatchGuildWelcomeWorkflow,
  DispatchKickoutWorkflow as BaseDispatchKickoutWorkflow,
  DispatchRoomOrderNextButtonWorkflow as BaseDispatchRoomOrderNextButtonWorkflow,
  DispatchRoomOrderPinTentativeButtonWorkflow as BaseDispatchRoomOrderPinTentativeButtonWorkflow,
  DispatchRoomOrderPreviousButtonWorkflow as BaseDispatchRoomOrderPreviousButtonWorkflow,
  DispatchRoomOrderSendButtonWorkflow as BaseDispatchRoomOrderSendButtonWorkflow,
  DispatchRoomOrderWorkflow as BaseDispatchRoomOrderWorkflow,
  DispatchServiceStatusWorkflow as BaseDispatchServiceStatusWorkflow,
  DispatchSlotButtonWorkflow as BaseDispatchSlotButtonWorkflow,
  DispatchSlotListWorkflow as BaseDispatchSlotListWorkflow,
  DispatchSlotOpenButtonWorkflow as BaseDispatchSlotOpenButtonWorkflow,
} from "sheet-ingress-api/sheet-cluster-workflows";

const dispatchShardGroup = () => "dispatch";

export const DispatchCheckinWorkflow = BaseDispatchCheckinWorkflow.annotate(
  ClusterSchema.ShardGroup,
  dispatchShardGroup,
);

export const DispatchRoomOrderWorkflow = BaseDispatchRoomOrderWorkflow.annotate(
  ClusterSchema.ShardGroup,
  dispatchShardGroup,
);

export const DispatchKickoutWorkflow = BaseDispatchKickoutWorkflow.annotate(
  ClusterSchema.ShardGroup,
  dispatchShardGroup,
);

export const DispatchSlotButtonWorkflow = BaseDispatchSlotButtonWorkflow.annotate(
  ClusterSchema.ShardGroup,
  dispatchShardGroup,
);

export const DispatchSlotListWorkflow = BaseDispatchSlotListWorkflow.annotate(
  ClusterSchema.ShardGroup,
  dispatchShardGroup,
);

export const DispatchSlotOpenButtonWorkflow = BaseDispatchSlotOpenButtonWorkflow.annotate(
  ClusterSchema.ShardGroup,
  dispatchShardGroup,
);

export const DispatchServiceStatusWorkflow = BaseDispatchServiceStatusWorkflow.annotate(
  ClusterSchema.ShardGroup,
  dispatchShardGroup,
);

export const DispatchGuildWelcomeWorkflow = BaseDispatchGuildWelcomeWorkflow.annotate(
  ClusterSchema.ShardGroup,
  dispatchShardGroup,
);

export const DispatchCheckinButtonWorkflow = BaseDispatchCheckinButtonWorkflow.annotate(
  ClusterSchema.ShardGroup,
  dispatchShardGroup,
);

export const DispatchRoomOrderPreviousButtonWorkflow =
  BaseDispatchRoomOrderPreviousButtonWorkflow.annotate(
    ClusterSchema.ShardGroup,
    dispatchShardGroup,
  );

export const DispatchRoomOrderNextButtonWorkflow = BaseDispatchRoomOrderNextButtonWorkflow.annotate(
  ClusterSchema.ShardGroup,
  dispatchShardGroup,
);

export const DispatchRoomOrderSendButtonWorkflow = BaseDispatchRoomOrderSendButtonWorkflow.annotate(
  ClusterSchema.ShardGroup,
  dispatchShardGroup,
);

export const DispatchRoomOrderPinTentativeButtonWorkflow =
  BaseDispatchRoomOrderPinTentativeButtonWorkflow.annotate(
    ClusterSchema.ShardGroup,
    dispatchShardGroup,
  );

export const DispatchWorkflows = [
  DispatchCheckinWorkflow,
  DispatchRoomOrderWorkflow,
  DispatchKickoutWorkflow,
  DispatchSlotButtonWorkflow,
  DispatchSlotListWorkflow,
  DispatchSlotOpenButtonWorkflow,
  DispatchServiceStatusWorkflow,
  DispatchGuildWelcomeWorkflow,
  DispatchCheckinButtonWorkflow,
  DispatchRoomOrderPreviousButtonWorkflow,
  DispatchRoomOrderNextButtonWorkflow,
  DispatchRoomOrderSendButtonWorkflow,
  DispatchRoomOrderPinTentativeButtonWorkflow,
] as const;
