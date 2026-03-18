import { Schema } from "effect";
import { PermissionValues } from "sheet-auth/plugins/kubernetes-oauth/client";

export const Permission = Schema.Literal(...PermissionValues);

export type Permission = Schema.Schema.Type<typeof Permission>;

export const CurrentUserPermissions = Schema.Struct({
  permissions: Schema.Array(Permission),
});
