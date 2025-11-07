import { autoCheckinTask } from "./autoCheckin";
import { Effect } from "effect";

export const tasks = [
  autoCheckinTask as unknown as Effect.Effect<unknown, unknown, never>,
];

export { autoCheckinTask };
