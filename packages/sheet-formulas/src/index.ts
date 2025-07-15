import "../polyfill/classPolyfill";

import { THEECALC as _THEECALC } from "./formulas";
import { onEdit as _onEdit } from "./levi";

/**
 * @preserve
 * Calculate Some Top Teams
 *
 * @customfunction
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function THEECALC(...args: Parameters<typeof _THEECALC>) {
  return _THEECALC(...args);
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function onEdit(...args: Parameters<typeof _onEdit>) {
  return _onEdit(...args);
}
