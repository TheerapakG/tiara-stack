import { Schema } from "effect";
export const BasePermissionValues = ["bot", "app_owner"] as const;
export const PermissionValues = BasePermissionValues;

export const UserPermission = Schema.String.pipe(
  Schema.filter((value): value is `user:${string}` => value.startsWith("user:")),
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
  UserPermission,
  MemberGuildPermission,
  MonitorGuildPermission,
  ManageGuildPermission,
);

export type Permission = Schema.Schema.Type<typeof Permission>;

export const CurrentUserPermissions = Schema.Struct({
  permissions: Schema.Array(Permission),
});
