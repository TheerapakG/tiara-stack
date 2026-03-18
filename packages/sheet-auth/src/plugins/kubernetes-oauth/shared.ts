export const PermissionValues = ["bot", "monitor_guild", "manage_guild"] as const;

export type Permission = (typeof PermissionValues)[number];
