import { useRef } from "react";
import { useIsPresent } from "motion/react";

/**
 * Hook to lock a value for exit animations.
 * Captures the value while the element is present and freezes it when exiting.
 * This prevents rapid state changes from causing visual glitches.
 *
 * @param value The current value to lock
 * @returns The locked value for exit animations
 */
export function useLocked<T>(value: T): T {
  const isPresent = useIsPresent();
  const lockedRef = useRef(value);
  if (isPresent) {
    lockedRef.current = value;
  }
  return lockedRef.current;
}
