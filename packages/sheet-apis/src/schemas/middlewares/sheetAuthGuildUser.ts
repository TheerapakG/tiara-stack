import { HashSet, Redacted, ServiceMap } from "effect";
import type { Permission, PermissionSet } from "@/schemas/permissions";

type SheetAuthGuildUserType = {
  // Discord user ID from the linked auth account.
  accountId: string;
  // Better Auth user ID for the auth-system user record.
  userId: string;
  guildId: string;
  permissions: PermissionSet;
  token: Redacted.Redacted<string>;
};

export const SheetAuthGuildUser = ServiceMap.Reference<SheetAuthGuildUserType>(
  "SheetAuthGuildUser",
  {
    defaultValue: () => ({
      accountId: "",
      userId: "",
      guildId: "",
      permissions: HashSet.empty<Permission>() as PermissionSet,
      token: Redacted.make(""),
    }),
  },
) as ServiceMap.Reference<SheetAuthGuildUserType> & {
  readonly Type: SheetAuthGuildUserType;
};
