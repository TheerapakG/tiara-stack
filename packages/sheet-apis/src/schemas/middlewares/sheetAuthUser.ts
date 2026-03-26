import { Context, Redacted } from "effect";
import type { Permission } from "@/schemas/permissions";

export class SheetAuthUser extends Context.Tag("SheetAuthUser")<
  SheetAuthUser,
  {
    // Discord user ID from the linked auth account.
    accountId: string;
    // Better Auth user ID for the auth-system user record.
    userId: string;
    permissions: Permission[];
    token: Redacted.Redacted<string>;
  }
>() {}
