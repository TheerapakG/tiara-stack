import "../polyfill/classPolyfill";

import {
  THEECALC as _THEECALC,
  THEECALC2 as _THEECALC2,
  onEditInstallable as _onEditInstallable,
} from "./formulas";

/**
 * @preserve
 * Calculate Some Top Teams
 *
 * @customfunction
 */
export function THEECALC(...args: Parameters<typeof _THEECALC>) {
  return _THEECALC(...args);
}

/**
 * @preserve
 * Calculate Some Top Teams
 *
 * @customfunction
 */
export function THEECALC2(...args: Parameters<typeof _THEECALC2>) {
  return _THEECALC2(...args);
}

export function onEditInstallable(
  ...args: Parameters<typeof _onEditInstallable>
) {
  return _onEditInstallable(...args);
}
