import type {
  MutateRequest,
  QueryOrQueryRequest,
  RunOptions,
  Schema as ZeroSchema,
} from "@rocicorp/zero";
import { Context, Effect, Schema } from "effect";
import * as ZeroApi from "./zeroApi";
import * as ZeroApiEndpoint from "./zeroApiEndpoint";
import * as ZeroApiGroup from "./zeroApiGroup";
import * as ZeroApiRegistry from "./zeroApiRegistry";
import {
  type MutatorError,
  MutatorResultAppError,
  MutatorResultZeroError,
  type QueryError,
} from "./zeroApiError";
import * as ZeroService from "../services/zeroService";

export type { QueryError, MutatorError } from "./zeroApiError";

type ServiceContext = ZeroService.ZeroServiceTag<ZeroSchema, any, any>;

type OptionalArgs<Args> = [Args] extends [undefined]
  ? readonly []
  : undefined extends Args
    ? readonly [] | readonly [args: Args]
    : readonly [args: Args];

type RunMutationPhase = () => Effect.Effect<void, MutatorError, never>;

export interface MutatorClientMethod<Args> {
  (...args: OptionalArgs<Args>): Effect.Effect<void, MutatorError, never>;
  readonly mutate: (...args: OptionalArgs<Args>) => Effect.Effect<
    {
      readonly client: RunMutationPhase;
      readonly server: RunMutationPhase;
    },
    Schema.SchemaError,
    never
  >;
}

export type ClientEndpoint<Endpoint extends ZeroApiEndpoint.Any> =
  Endpoint extends ZeroApiEndpoint.AnyQuery
    ? (
        ...args: OptionalArgs<ZeroApiEndpoint.RequestType<Endpoint>>
      ) => Effect.Effect<ZeroApiEndpoint.SuccessType<Endpoint>, QueryError, never>
    : Endpoint extends ZeroApiEndpoint.AnyMutator
      ? MutatorClientMethod<ZeroApiEndpoint.RequestType<Endpoint>>
      : never;

type EndpointNames<Group extends ZeroApiGroup.Any> =
  ZeroApiGroup.Endpoints<Group> extends infer Endpoint
    ? Endpoint extends ZeroApiEndpoint.Any
      ? Endpoint["name"]
      : never
    : never;

type EndpointWithName<Group extends ZeroApiGroup.Any, Name extends string> = Extract<
  ZeroApiGroup.Endpoints<Group>,
  { readonly name: Name }
>;

export type ClientGroup<Group extends ZeroApiGroup.Any> = {
  readonly [Name in EndpointNames<Group>]: ClientEndpoint<EndpointWithName<Group, Name>>;
};

export type Client<Api extends ZeroApi.Any> = {
  readonly [Group in ZeroApi.Groups<Api> as Group["identifier"]]: ClientGroup<Group>;
};

const defaultRunOptions: RunOptions = { type: "complete" };

const flattenMutationPhase = (
  phase: () => Effect.Effect<
    void | MutatorResultAppError | MutatorResultZeroError,
    Schema.SchemaError,
    never
  >,
): RunMutationPhase =>
  Effect.fn("ZeroApiClient.mutationPhase")(function* () {
    const result = yield* phase();
    if (result instanceof MutatorResultAppError || result instanceof MutatorResultZeroError) {
      return yield* Effect.fail(result);
    }
  });

const getArgs = (args: readonly unknown[]): unknown => (args.length > 0 ? args[0] : undefined);

const makeQueryMethod = (
  zeroService: ZeroService.ZeroService<any, any, any>,
  registryMethod: (args?: unknown) => QueryOrQueryRequest<any, any, any, any, any, any>,
  group: ZeroApiGroup.Any,
  endpoint: ZeroApiEndpoint.AnyQuery,
) =>
  Effect.fn(`ZeroApiClient.${group.identifier}.${endpoint.name}`)(function* (
    ...args: readonly unknown[]
  ) {
    const encoded = yield* Schema.encodeEffect(endpoint.request)(getArgs(args));
    const queryRequest = registryMethod(encoded as any);
    const result = yield* zeroService.run(queryRequest, endpoint.runOptions ?? defaultRunOptions);
    return yield* Schema.decodeUnknownEffect(endpoint.success)(result);
  });

const makeMutatorMethod = (
  zeroService: ZeroService.ZeroService<any, any, any>,
  registryMethod: (args?: unknown) => MutateRequest<any, any, any, any>,
  group: ZeroApiGroup.Any,
  endpoint: ZeroApiEndpoint.AnyMutator,
) => {
  const mutate = Effect.fn(`ZeroApiClient.${group.identifier}.${endpoint.name}.mutate`)(function* (
    ...args: readonly unknown[]
  ) {
    const encoded = yield* Schema.encodeEffect(endpoint.request)(getArgs(args));
    const mutation = yield* zeroService.mutate(registryMethod(encoded as any));
    return {
      client: flattenMutationPhase(mutation.client),
      server: flattenMutationPhase(mutation.server),
    };
  });

  const method = Effect.fn(`ZeroApiClient.${group.identifier}.${endpoint.name}`)(function* (
    ...args: readonly unknown[]
  ) {
    const mutation = yield* mutate(...args);
    return yield* mutation.server();
  }) as MutatorClientMethod<unknown>;

  Object.defineProperty(method, "mutate", {
    value: mutate,
    enumerable: true,
  });

  return method;
};

const makeClient = <Api extends ZeroApi.Any>(
  api: Api,
  zeroService: ZeroService.ZeroService<any, any, any>,
): Client<Api> => {
  const queries = ZeroApiRegistry.toQueries(api) as any;
  const mutators = ZeroApiRegistry.toMutators(api) as any;
  const client: Record<string, Record<string, unknown>> = {};

  for (const group of Object.values(api.groups)) {
    const groupClient: Record<string, unknown> = {};
    for (const endpoint of Object.values(group.endpoints)) {
      if (endpoint.kind === "query") {
        groupClient[endpoint.name] = makeQueryMethod(
          zeroService,
          queries[group.identifier][endpoint.name],
          group,
          endpoint,
        );
      } else {
        groupClient[endpoint.name] = makeMutatorMethod(
          zeroService,
          mutators[group.identifier][endpoint.name],
          group,
          endpoint,
        );
      }
    }
    client[group.identifier] = groupClient;
  }

  return client as Client<Api>;
};

export const makeWithService = <Api extends ZeroApi.Any>(
  api: Api,
  zeroService: ZeroService.ZeroService<any, any, any>,
): Effect.Effect<Client<Api>, never, never> => Effect.sync(() => makeClient(api, zeroService));

export const make = <Api extends ZeroApi.Any>(
  api: Api,
): Effect.Effect<Client<Api>, never, ServiceContext> =>
  Effect.gen(function* () {
    const zeroService = yield* ZeroService.ZeroService<ZeroSchema, any, any>();
    return yield* makeWithService(api, zeroService);
  });

export const Service =
  <Self>() =>
  <const Id extends string, Api extends ZeroApi.Any>(
    id: Id,
    options: {
      readonly api: Api;
    },
  ) =>
    Context.Service<Self, Client<Api>>()(id, {
      make: make(options.api),
    });
