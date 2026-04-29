import { ZeroApiRegistry } from "typhoon-core/zeroApi";
import { SheetZeroApi } from "./api";
import type { Schema } from "./schema";

export type Mutators = ReturnType<typeof ZeroApiRegistry.toMutators<typeof SheetZeroApi, Schema>>;

export const mutators: Mutators = ZeroApiRegistry.toMutators(SheetZeroApi) as Mutators;
