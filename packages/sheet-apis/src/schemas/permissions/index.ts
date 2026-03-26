import { Schema } from "effect";
export const BasePermissionValues = ["bot", "app_owner"] as const;
export const PermissionValues = BasePermissionValues;

export const DiscordAccountPermission = Schema.String.pipe(
  Schema.filter((value): value is `account:discord:${string}` =>
    value.startsWith("account:discord:"),
  ),
);

export const MemberGuildPermission = Schema.String.pipe(
  Schema.filter((value): value is `member_guild:${string}` => value.startsWith("member_guild:")),
);

export const MonitorGuildPermission = Schema.String.pipe(
  Schema.filter((value): value is `monitor_guild:${string}` => value.startsWith("monitor_guild:")),
);

export const ManageGuildPermission = Schema.String.pipe(
  Schema.filter((value): value is `manage_guild:${string}` => value.startsWith("manage_guild:")),
);

export const Permission = Schema.Union(
  Schema.Literal(...BasePermissionValues),
  DiscordAccountPermission,
  MemberGuildPermission,
  MonitorGuildPermission,
  ManageGuildPermission,
);

export type Permission = Schema.Schema.Type<typeof Permission>;

export const PermissionSet = Schema.HashSet(Permission);

export type PermissionSet = Schema.Schema.Type<typeof PermissionSet>;

export const CurrentUserPermissions = Schema.Struct({
  permissions: PermissionSet,
});
