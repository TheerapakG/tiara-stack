import { DateTime } from "effect";
import { useMemo } from "react";

export const makeDateTime = (timestamp: number) => DateTime.unsafeMake(timestamp);

export const useDateTime = (timestamp: number) => {
  const dateTime = useMemo(() => makeDateTime(timestamp), [timestamp]);
  return dateTime;
};
