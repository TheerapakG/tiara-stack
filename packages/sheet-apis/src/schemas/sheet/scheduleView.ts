import { Schema } from "effect";
import type { Permission } from "sheet-auth/plugins/kubernetes-oauth/client";
import { BreakSchedule, Schedule } from "./schedule";
import { PopulatedScheduleResult } from "./populatedSchedule";

export const ScheduleView = Schema.Literal("filler", "monitor");

export type ScheduleView = Schema.Schema.Type<typeof ScheduleView>;

export const ScheduleResponse = Schema.Struct({
  view: ScheduleView,
  schedules: Schema.Array(Schema.Union(BreakSchedule, Schedule)),
});

export type ScheduleResponse = Schema.Schema.Type<typeof ScheduleResponse>;

export const PopulatedScheduleResponse = Schema.Struct({
  view: ScheduleView,
  schedules: Schema.Array(PopulatedScheduleResult),
});

export type PopulatedScheduleResponse = Schema.Schema.Type<typeof PopulatedScheduleResponse>;

export const getMaximumScheduleView = (permissions: ReadonlyArray<Permission>): ScheduleView =>
  permissions.includes("monitor_guild") ? "monitor" : "filler";

export const getEffectiveScheduleView = (
  maximumView: ScheduleView,
  requestedView?: ScheduleView,
): ScheduleView => {
  const normalizedRequestedView = requestedView ?? maximumView;
  return normalizedRequestedView === "monitor" && maximumView === "monitor" ? "monitor" : "filler";
};
