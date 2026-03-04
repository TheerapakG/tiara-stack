import { Atom, Registry, Result, scheduleTask } from "@effect-atom/atom-react";
import { createIsomorphicFn } from "@tanstack/react-start";

const atomRegistryScheduleTask = createIsomorphicFn()
  .server((callback: () => void) => setTimeout(callback, 0))
  .client(scheduleTask);

export const makeAtomRegistry = () =>
  Registry.make({
    scheduleTask: atomRegistryScheduleTask,
    defaultIdleTTL: 400,
  });

export const ensureResultAtomData = <A, E>(
  registry: Registry.Registry,
  atom: Atom.Atom<Result.Result<A, E>>,
) => Registry.getResult(registry, atom);
