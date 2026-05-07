export { DispatchRpcs } from "./sheet-apis-rpc";
import { DispatchRpcs, HealthRpcs } from "./sheet-apis-rpc";

export const SheetClusterRpcs = DispatchRpcs.merge(HealthRpcs);
