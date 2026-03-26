import { Context, Redacted } from "effect";
import type { PermissionSet } from "@/schemas/permissions";

export class SheetAuthGuildUser extends Context.Tag("SheetAuthGuildUser")<
  SheetAuthGuildUser,
  {
    // Discord user ID from the linked auth account.
    accountId: string;
    // Better Auth user ID for the auth-system user record.
    userId: string;
    guildId: string;
    permissions: PermissionSet;
    token: Redacted.Redacted<string>;
  }
>() {}
