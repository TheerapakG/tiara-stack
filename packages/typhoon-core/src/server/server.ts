import { MutationHandlerContext, SubscriptionHandlerContext } from "./handler";

export const ServerSymbol = Symbol("Typhoon/Server/Server");

export class Server<
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  SubscriptionHandlers extends Record<string, SubscriptionHandlerContext> = {},
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  MutationHandlers extends Record<string, MutationHandlerContext> = {},
> {
  readonly [ServerSymbol]: Server<SubscriptionHandlers, MutationHandlers> =
    this;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyServer = Server<any, any>;

export type ServerSubscriptionHandlers<S extends AnyServer> = [
  S[typeof ServerSymbol],
] extends [Server<infer SubscriptionHandlers, infer _MutationHandlers>]
  ? SubscriptionHandlers extends Record<string, SubscriptionHandlerContext>
    ? SubscriptionHandlers
    : never
  : never;

export type ServerMutationHandlers<S extends AnyServer> = [
  S[typeof ServerSymbol],
] extends [Server<infer _SubscriptionHandlers, infer MutationHandlers>]
  ? MutationHandlers extends Record<string, MutationHandlerContext>
    ? MutationHandlers
    : never
  : never;
