import type { Permission } from "@/schemas/permissions";
import {
  getEffectiveScheduleView,
  getMaximumScheduleView,
  type ScheduleView,
} from "@/schemas/sheet";

export const resolveScheduleViewFromPermissions = (
  permissions: ReadonlyArray<Permission>,
  guildId: string,
  requestedView?: ScheduleView,
) => getEffectiveScheduleView(getMaximumScheduleView(permissions, guildId), requestedView);
