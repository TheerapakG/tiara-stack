import {
  defineMutator,
  defineMutators,
  defineQuery,
  defineQueries,
  type QueryDefinition,
  type QueryRegistry,
  type MutatorDefinition,
  type MutatorRegistry,
  type ReadonlyJSONValue,
  type Schema as ZeroSchema,
} from "@rocicorp/zero";
import { Schema } from "effect";
import * as ZeroApi from "./zeroApi";
import * as ZeroApiEndpoint from "./zeroApiEndpoint";
import * as ZeroApiGroup from "./zeroApiGroup";

type QueryEndpointDefinition<Endpoint extends ZeroApiEndpoint.Any> =
  Endpoint extends ZeroApiEndpoint.QueryEndpoint<
    any,
    infer Request,
    any,
    infer TTable,
    any,
    infer TReturn,
    infer TContext
  >
    ? QueryDefinition<
        TTable,
        ZeroApiEndpoint.RequestEncoded<Endpoint>,
        Request["Type"] & ReadonlyJSONValue,
        TReturn,
        TContext
      >
    : never;

type MutatorEndpointDefinition<Endpoint extends ZeroApiEndpoint.Any> =
  Endpoint extends ZeroApiEndpoint.MutatorEndpoint<
    any,
    infer Request,
    any,
    infer TContext,
    infer TWrappedTransaction
  >
    ? MutatorDefinition<
        ZeroApiEndpoint.RequestEncoded<Endpoint>,
        Request["Type"] & ReadonlyJSONValue,
        TContext,
        TWrappedTransaction
      >
    : never;

export type QueryDefinitionsForGroup<Group extends ZeroApiGroup.Any> = {
  readonly [Endpoint in ZeroApiGroup.Endpoints<Group> as Endpoint extends ZeroApiEndpoint.AnyQuery
    ? Endpoint["name"]
    : never]: QueryEndpointDefinition<Endpoint>;
};

export type MutatorDefinitionsForGroup<Group extends ZeroApiGroup.Any> = {
  readonly [Endpoint in ZeroApiGroup.Endpoints<Group> as Endpoint extends ZeroApiEndpoint.AnyMutator
    ? Endpoint["name"]
    : never]: MutatorEndpointDefinition<Endpoint>;
};

export type QueryDefinitionsForApi<Api extends ZeroApi.Any> = {
  readonly [Group in ZeroApi.Groups<Api> as QueryDefinitionsForGroup<Group> extends Record<
    string,
    never
  >
    ? never
    : Group["identifier"]]: QueryDefinitionsForGroup<Group>;
};

export type MutatorDefinitionsForApi<Api extends ZeroApi.Any> = {
  readonly [Group in ZeroApi.Groups<Api> as MutatorDefinitionsForGroup<Group> extends Record<
    string,
    never
  >
    ? never
    : Group["identifier"]]: MutatorDefinitionsForGroup<Group>;
};

const toStandardSchema = <A extends Schema.Top>(schema: A) =>
  Schema.toStandardSchemaV1(schema as any) as any;

export const toQueries = <Api extends ZeroApi.Any, S extends ZeroSchema = ZeroSchema>(api: Api) => {
  const groups: Record<string, Record<string, unknown>> = {};
  for (const group of Object.values(api.groups)) {
    const endpoints: Record<string, unknown> = {};
    for (const endpoint of Object.values(group.endpoints)) {
      if (endpoint.kind === "query") {
        endpoints[endpoint.name] = defineQuery(
          toStandardSchema(endpoint.request),
          ({ args, ctx }: any) => endpoint.query({ args, ctx }),
        );
      }
    }
    if (Object.keys(endpoints).length > 0) {
      groups[group.identifier] = endpoints;
    }
  }
  return defineQueries(groups as any) as QueryRegistry<QueryDefinitionsForApi<Api>, S>;
};

export const toMutators = <Api extends ZeroApi.Any, S extends ZeroSchema = ZeroSchema>(
  api: Api,
) => {
  const groups: Record<string, Record<string, unknown>> = {};
  for (const group of Object.values(api.groups)) {
    const endpoints: Record<string, unknown> = {};
    for (const endpoint of Object.values(group.endpoints)) {
      if (endpoint.kind === "mutator") {
        endpoints[endpoint.name] = defineMutator(
          toStandardSchema(endpoint.request),
          ({ args, ctx, tx }: any) => endpoint.mutator({ args, ctx, tx }),
        );
      }
    }
    if (Object.keys(endpoints).length > 0) {
      groups[group.identifier] = endpoints;
    }
  }
  return defineMutators(groups as any) as MutatorRegistry<MutatorDefinitionsForApi<Api>, S>;
};
