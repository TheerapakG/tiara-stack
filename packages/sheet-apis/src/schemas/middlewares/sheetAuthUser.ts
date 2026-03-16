import { Context, Redacted } from "effect";
import type { Permission } from "sheet-auth/plugins/kubernetes-oauth/client";

export class SheetAuthUser extends Context.Tag("SheetAuthUser")<
  SheetAuthUser,
  {
    userId: string;
    permissions: Permission[];
    token: Redacted.Redacted<string>;
  }
>() {}
