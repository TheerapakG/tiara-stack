import { ZeroApiRegistry } from "typhoon-zero/zeroApi";
import { SheetZeroApi } from "./api";
import type { Schema } from "./schema";

export type Mutators = ReturnType<typeof ZeroApiRegistry.toMutators<typeof SheetZeroApi, Schema>>;

export const mutators: Mutators = ZeroApiRegistry.toMutators(SheetZeroApi) as Mutators;
