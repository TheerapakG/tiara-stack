import { Context } from "effect";
import type { Zero } from "@rocicorp/zero";

/**
 * ZeroService provides access to a Zero instance.
 */
export class ZeroService extends Context.Tag("ZeroService")<
  ZeroService,
  Zero<any>
>() {}
