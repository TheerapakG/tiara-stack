import { HashSet, Redacted, ServiceMap } from "effect";
import type { Permission, PermissionSet } from "@/schemas/permissions";

type SheetAuthUserType = {
  // Discord user ID from the linked auth account.
  accountId: string;
  // Better Auth user ID for the auth-system user record.
  userId: string;
  permissions: PermissionSet;
  token: Redacted.Redacted<string>;
};

export const SheetAuthUser = ServiceMap.Reference<SheetAuthUserType>("SheetAuthUser", {
  defaultValue: () => ({
    accountId: "",
    userId: "",
    permissions: HashSet.empty<Permission>() as PermissionSet,
    token: Redacted.make(""),
  }),
}) as ServiceMap.Reference<SheetAuthUserType> & { readonly Type: SheetAuthUserType };
