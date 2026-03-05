import { Atom, Registry, Result, scheduleTask } from "@effect-atom/atom-react";
import { createIsomorphicFn } from "@tanstack/react-start";
import { Effect } from "effect";

const atomRegistryScheduleTask = createIsomorphicFn()
  .server((callback: () => void) => setTimeout(callback, 0))
  .client(scheduleTask);

export const makeAtomRegistry = () =>
  Registry.make({
    scheduleTask: atomRegistryScheduleTask,
    defaultIdleTTL: 400,
  });

const enum NodeFlags {
  alive = 1 << 0,
  initialized = 1 << 1,
  waitingForValue = 1 << 2,
}

const enum NodeState {
  uninitialized = NodeFlags.alive | NodeFlags.waitingForValue,
  stale = NodeFlags.alive | NodeFlags.initialized | NodeFlags.waitingForValue,
  valid = NodeFlags.alive | NodeFlags.initialized,
  removed = 0,
}

interface Node<A> {
  readonly state: NodeState;
  readonly canBeRemoved: boolean;
  readonly _value: A;
  readonly subscribe: (listener: () => void) => () => void;
}

/**
 * ⚠️ INTERNAL API DEPENDENCY ⚠️
 * This interface mirrors internal implementation details of `@effect-atom/atom-react`.
 * The casting `registry as unknown as Registry` accesses undocumented internals:
 * - `getNodes()` - returns internal node map
 * - `ensureNode()` - creates/retrieves node for atom
 * - `scheduleNodeRemoval()` - marks node for cleanup
 * - `NodeFlags`/`NodeState` bit layout
 *
 * Last verified against: @effect-atom/atom-react@^0.5.0
 * Breaking changes in library internals will cause runtime failures.
 *
 * TODO: Replace with public API when available:
 * @see https://github.com/effect-atom/atom-react/issues (check for expose API requests)
 */
interface Registry {
  readonly getNodes: () => ReadonlyMap<Atom.Atom<any> | string, Node<any>>;
  readonly ensureNode: <A>(atom: Atom.Atom<A>) => Node<A>;
  readonly scheduleNodeRemoval: (node: Node<any>) => void;
}

const ensureAtomDataNode = <A>(registry: Registry.Registry, atom: Atom.Atom<A>) => {
  const registryImpl = registry as unknown as Registry;

  // Runtime safety check: fail fast if internal API changes
  if (
    typeof registryImpl.getNodes !== "function" ||
    typeof registryImpl.ensureNode !== "function" ||
    typeof registryImpl.scheduleNodeRemoval !== "function"
  ) {
    throw new Error(
      "[@effect-atom/atom-react internal API mismatch] " +
        "One or more of getNodes/ensureNode/scheduleNodeRemoval is not a function. " +
        "The library internals may have changed. " +
        "Please verify compatibility with @effect-atom/atom-react version.",
    );
  }

  const node = registryImpl.getNodes().get(atom) as Node<A> | undefined;

  const isCached =
    node !== undefined &&
    (node.state & NodeFlags.alive) !== 0 &&
    (node.state & NodeFlags.initialized) !== 0;

  if (isCached) {
    return node;
  }

  return registryImpl.ensureNode(atom);
};

export const ensureAtomData = <A>(registry: Registry.Registry, atom: Atom.Atom<A>) =>
  ensureAtomDataNode(registry, atom)._value;

export const ensureResultAtomData = <A, E>(
  registry: Registry.Registry,
  atom: Atom.Atom<Result.Result<A, E>>,
): Effect.Effect<A, E> =>
  Effect.async((resume) => {
    const registryImpl = registry as unknown as Registry;
    const node = ensureAtomDataNode(registry, atom);
    if (node._value._tag !== "Initial") {
      return resume(Result.toExit(node._value) as Effect.Effect<A, E>);
    }
    const unsubscribe = node.subscribe(() => {
      if (node._value._tag !== "Initial") {
        resume(Result.toExit(node._value) as Effect.Effect<A, E>);
        cancel();
      }
    });
    const cancel = () => {
      unsubscribe();
      if (node.canBeRemoved) {
        registryImpl.scheduleNodeRemoval(node);
      }
    };
    return Effect.sync(cancel);
  });
