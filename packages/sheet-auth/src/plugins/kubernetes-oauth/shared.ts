export const BasePermissionValues = ["bot", "app_owner"] as const;

// Backward-compatible alias for existing imports that enumerate fixed permissions.
export const PermissionValues = BasePermissionValues;

export type BasePermission = (typeof BasePermissionValues)[number];
export type UserPermission = `user:${string}`;
export type MemberGuildPermission = `member_guild:${string}`;
export type MonitorGuildPermission = `monitor_guild:${string}`;
export type ManageGuildPermission = `manage_guild:${string}`;
export type Permission =
  | BasePermission
  | UserPermission
  | MemberGuildPermission
  | MonitorGuildPermission
  | ManageGuildPermission;
