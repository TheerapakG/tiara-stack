import type { PermissionSet } from "@/schemas/permissions";
import {
  getEffectiveScheduleView,
  getMaximumScheduleView,
  type ScheduleView,
} from "@/schemas/sheet";

export const resolveScheduleViewFromPermissions = (
  permissions: PermissionSet,
  guildId: string,
  requestedView?: ScheduleView,
) => getEffectiveScheduleView(getMaximumScheduleView(permissions, guildId), requestedView);
