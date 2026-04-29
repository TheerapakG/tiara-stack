import { ZeroApiRegistry } from "typhoon-zero/zeroApi";
import { SheetZeroApi } from "./api";
import type { Schema } from "./schema";

export type Queries = ReturnType<typeof ZeroApiRegistry.toQueries<typeof SheetZeroApi, Schema>>;

export const queries: Queries = ZeroApiRegistry.toQueries(SheetZeroApi) as Queries;
