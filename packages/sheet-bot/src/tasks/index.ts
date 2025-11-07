import { autoCheckinTask } from "./autoCheckin";
import { Effect, pipe } from "effect";
import { botServices } from "@/services";

export const tasks = [
  pipe(autoCheckinTask, Effect.provide(botServices)) as Effect.Effect<
    unknown,
    unknown,
    never
  >,
];

export { autoCheckinTask };
