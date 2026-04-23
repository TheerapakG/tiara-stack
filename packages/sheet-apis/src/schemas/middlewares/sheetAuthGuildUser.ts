import { Redacted, Context } from "effect";
import type { PermissionSet } from "@/schemas/permissions";

type SheetAuthGuildUserType = {
  // Discord user ID from the linked auth account.
  accountId: string;
  // Better Auth user ID for the auth-system user record.
  userId: string;
  guildId: string;
  permissions: PermissionSet;
  token: Redacted.Redacted<string>;
};

export class SheetAuthGuildUser extends Context.Service<
  SheetAuthGuildUser,
  SheetAuthGuildUserType
>()("SheetAuthGuildUser") {}
