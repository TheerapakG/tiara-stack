import { Context, Redacted } from "effect";
import type { Permission } from "@/schemas/permissions";

export class SheetAuthUser extends Context.Tag("SheetAuthUser")<
  SheetAuthUser,
  {
    accountId: string;
    userId: string;
    permissions: Permission[];
    token: Redacted.Redacted<string>;
  }
>() {}
