import "../polyfill/classPolyfill";

import { THEECALC as _THEECALC } from "./formulas";
import { onEdit as _onEdit } from "./levi";

/**
 * @preserve
 * Calculate Some Top Teams
 *
 * @customfunction
 */
export function THEECALC(...args: Parameters<typeof _THEECALC>) {
  return _THEECALC(...args);
}

export function onEdit(...args: Parameters<typeof _onEdit>) {
  return _onEdit(...args);
}
