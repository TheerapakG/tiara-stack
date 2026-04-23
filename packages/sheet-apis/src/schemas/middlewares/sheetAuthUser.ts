import { Redacted, Context } from "effect";
import type { PermissionSet } from "@/schemas/permissions";

type SheetAuthUserType = {
  // Discord user ID from the linked auth account.
  accountId: string;
  // Better Auth user ID for the auth-system user record.
  userId: string;
  permissions: PermissionSet;
  token: Redacted.Redacted<string>;
};

export class SheetAuthUser extends Context.Service<SheetAuthUser, SheetAuthUserType>()(
  "SheetAuthUser",
) {}
