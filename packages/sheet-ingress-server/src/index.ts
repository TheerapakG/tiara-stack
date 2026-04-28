import { NodeFileSystem, NodeHttpClient, NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import { createServer } from "http";
import {
  Cache,
  ConfigProvider,
  Context,
  Duration,
  Effect,
  Exit,
  FileSystem,
  HashSet,
  Layer,
  Logger,
  Option,
  Redacted,
} from "effect";
import {
  HttpMiddleware,
  HttpRouter,
  HttpServer,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/unstable/http";
import {
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSwagger,
} from "effect/unstable/httpapi";
import { Unauthorized as SheetBotUnauthorized } from "dfx-discord-utils/discord/schema";
import { Api } from "sheet-ingress-api/api";
import { SheetAuthUser } from "sheet-ingress-api/schemas/middlewares/sheetAuthUser";
import { Unauthorized } from "sheet-ingress-api/schemas/middlewares/unauthorized";
import { ArgumentError, makeArgumentError } from "typhoon-core/error";
import { config } from "./config";
import {
  AuthorizationService,
  hasDiscordAccountPermission,
  hasGuildPermission,
  hasPermission,
  SheetAuthTokenAuthorizationLive,
} from "./services/authorization";
import { SheetAuthUserResolver } from "./services/authResolver";
import { MessageLookup } from "./services/messageLookup";
import { SheetApisForwardingClient } from "./services/sheetApisForwardingClient";
import { SheetApisRpcTokens } from "./services/sheetApisRpcTokens";
import { SheetBotForwardingClient } from "./services/sheetBotForwardingClient";
import { TelemetryLive } from "./telemetry";

function isOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
  return allowedOrigins.some((allowed) => {
    if (allowed === origin) {
      return true;
    }
    if (allowed.includes("*")) {
      const withPlaceholder = allowed.replace(/\*/g, "\x00");
      const escaped = withPlaceholder.replace(/[.+^${}()|[\]\\]/g, "\\$&");
      // eslint-disable-next-line no-control-regex
      const regex = new RegExp(`^${escaped.replace(/\x00/g, "[^./]*")}$`);
      return regex.test(origin);
    }
    return false;
  });
}

const getBearerAuthorization = (request: HttpServerRequest.HttpServerRequest) => {
  const authorization = request.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return undefined;
  }

  return authorization.slice("Bearer ".length).trim() === "" ? undefined : authorization;
};

type ServiceTokenAuthorizerService = {
  readonly hasServicePermission: (authorization: string) => Effect.Effect<boolean, unknown>;
};

class ServiceTokenAuthorizer extends Context.Service<
  ServiceTokenAuthorizer,
  ServiceTokenAuthorizerService
>()("ServiceTokenAuthorizer") {
  static layer = Layer.effect(
    ServiceTokenAuthorizer,
    Effect.gen(function* () {
      const sheetAuthUserResolver = yield* SheetAuthUserResolver;
      const servicePermissionCache = yield* Cache.makeWith(
        (authorization: string) =>
          sheetAuthUserResolver
            .resolveToken(Redacted.make(authorization.slice("Bearer ".length).trim()))
            .pipe(
              Effect.map(({ permissions }) => hasPermission(permissions, "service")),
              Effect.tapError((error) =>
                Effect.logWarning("Failed to authorize service token for bot proxy route", error),
              ),
            ),
        {
          capacity: 10_000,
          timeToLive: Exit.match({
            onFailure: () => Duration.seconds(1),
            onSuccess: () => Duration.seconds(30),
          }),
        },
      );

      return {
        hasServicePermission: (authorization: string) =>
          Cache.get(servicePermissionCache, authorization),
      };
    }),
  ).pipe(Layer.provide(SheetAuthUserResolver.layer));
}

const hasServiceTokenFromRequest = (request: HttpServerRequest.HttpServerRequest) =>
  Effect.gen(function* () {
    const authorization = getBearerAuthorization(request);
    if (!authorization) {
      return false;
    }

    const serviceTokenAuthorizer = yield* ServiceTokenAuthorizer;
    return yield* serviceTokenAuthorizer
      .hasServicePermission(authorization)
      .pipe(Effect.catch(() => Effect.succeed(false)));
  });

type SheetBotGroups = (typeof Api)["groups"][keyof (typeof Api)["groups"]];
type SheetBotGroupName = Extract<HttpApiGroup.Name<SheetBotGroups>, "application" | "cache">;
type SheetBotGroup<GroupName extends SheetBotGroupName> = HttpApiGroup.WithName<
  SheetBotGroups,
  GroupName
>;
type SheetBotEndpointName<GroupName extends SheetBotGroupName> = Extract<
  HttpApiEndpoint.Name<HttpApiGroup.Endpoints<SheetBotGroup<GroupName>>>,
  string
>;
type SheetBotProxyHandler<
  GroupName extends SheetBotGroupName,
  EndpointName extends SheetBotEndpointName<GroupName>,
> = HttpApiEndpoint.HandlerWithName<
  HttpApiGroup.Endpoints<SheetBotGroup<GroupName>>,
  EndpointName,
  never,
  SheetBotForwardingClient | ServiceTokenAuthorizer
>;
type SheetBotEndpointClient = (args: unknown) => Effect.Effect<unknown, unknown, unknown>;

const proxySheetBot =
  <GroupName extends SheetBotGroupName, EndpointName extends SheetBotEndpointName<GroupName>>(
    group: GroupName,
    endpoint: EndpointName,
  ): SheetBotProxyHandler<GroupName, EndpointName> =>
  (args) =>
    Effect.gen(function* () {
      const requestArgs = args as {
        readonly request: HttpServerRequest.HttpServerRequest;
      } & Record<string, unknown>;
      const hasServicePermission = yield* hasServiceTokenFromRequest(requestArgs.request);
      if (!hasServicePermission) {
        return yield* Effect.fail(new SheetBotUnauthorized({ message: "Unauthorized" }));
      }

      const client = yield* SheetBotForwardingClient;
      const groupClient = (
        client as unknown as Record<string, Record<string, SheetBotEndpointClient>>
      )[group];
      const endpointClient = groupClient?.[endpoint];
      if (typeof endpointClient !== "function") {
        return yield* Effect.die(new Error(`Unknown sheet-bot proxy target: ${group}.${endpoint}`));
      }

      return yield* endpointClient(clientArgsFrom(requestArgs));
    }) as ReturnType<SheetBotProxyHandler<GroupName, EndpointName>>;

const getModernMessageGuildId = <
  T extends {
    readonly guildId: Option.Option<string>;
    readonly messageChannelId: Option.Option<string>;
  },
>(
  record: T,
) =>
  Option.match(record.guildId, {
    onSome: (guildId) =>
      Option.isSome(record.messageChannelId) ? Option.some(guildId) : Option.none(),
    onNone: () => Option.none(),
  });

const missingMessage = (kind: string) =>
  makeArgumentError(`Cannot get ${kind}, the message might not be registered`);

const legacyDenied = (kind: string) =>
  Effect.fail(new Unauthorized({ message: `Legacy ${kind} records are no longer accessible` }));

const authorizationArgumentError = (kind: string) => (cause: unknown) =>
  cause instanceof Unauthorized || cause instanceof ArgumentError
    ? cause
    : makeArgumentError(`Cannot authorize ${kind}`, cause);

const authorizationUnauthorized = (kind: string) => (cause: unknown) =>
  cause instanceof Unauthorized
    ? cause
    : new Unauthorized({ message: `Cannot authorize ${kind}`, cause });

const getRequiredModernGuildId = <T extends Parameters<typeof getModernMessageGuildId>[0]>(
  record: T,
  kind: string,
) =>
  Option.match(getModernMessageGuildId(record), {
    onSome: Effect.succeed,
    onNone: () => legacyDenied(kind),
  });

const clientArgsFrom = (args: Record<string, unknown>) => {
  const { request: _request, ...clientArgs } = args;
  return Object.keys(clientArgs).length === 0 ? undefined : clientArgs;
};

const corsMiddlewareLayer = Layer.unwrap(
  Effect.gen(function* () {
    const trustedOrigins = [...(yield* config.trustedOrigins)];
    return HttpRouter.middleware(
      HttpMiddleware.cors({
        allowedOrigins: (origin) => isOriginAllowed(origin, trustedOrigins),
        allowedHeaders: ["Content-Type", "Authorization", "b3", "traceparent", "tracestate"],
        allowedMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"],
        exposedHeaders: ["Content-Length"],
        maxAge: 600,
        credentials: true,
      }),
      { global: true },
    );
  }),
);

type SheetIngressGroups = (typeof Api)["groups"][keyof (typeof Api)["groups"]];
type SheetApisForwardingClientService = typeof SheetApisForwardingClient.Service;
type SheetApisGroupName = Extract<
  keyof SheetApisForwardingClientService,
  HttpApiGroup.Name<SheetIngressGroups>
>;
type SheetApisGroup<GroupName extends SheetApisGroupName> = HttpApiGroup.WithName<
  SheetIngressGroups,
  GroupName
>;
type SheetApisEndpointName<GroupName extends SheetApisGroupName> = Extract<
  HttpApiEndpoint.Name<HttpApiGroup.Endpoints<SheetApisGroup<GroupName>>>,
  keyof SheetApisForwardingClientService[GroupName] & string
>;
type SheetApisEndpoint<GroupName extends SheetApisGroupName> = HttpApiGroup.Endpoints<
  SheetApisGroup<GroupName>
>;
type SheetApisProxyRequest<
  GroupName extends SheetApisGroupName,
  EndpointName extends SheetApisEndpointName<GroupName>,
> = HttpApiEndpoint.Request<HttpApiEndpoint.WithName<SheetApisEndpoint<GroupName>, EndpointName>>;
type SheetApisProxyError<
  GroupName extends SheetApisGroupName,
  EndpointName extends SheetApisEndpointName<GroupName>,
> = HttpApiEndpoint.ErrorsWithName<SheetApisEndpoint<GroupName>, EndpointName>;
type SheetApisProxyHandler<
  GroupName extends SheetApisGroupName,
  EndpointName extends SheetApisEndpointName<GroupName>,
  R,
> = HttpApiEndpoint.HandlerWithName<
  SheetApisEndpoint<GroupName>,
  EndpointName,
  SheetApisProxyError<GroupName, EndpointName>,
  SheetApisForwardingClient | SheetApisRpcTokens | R
>;
type SheetApisEndpointClient = (args: unknown) => Effect.Effect<unknown, unknown, unknown>;

const proxySheetApis =
  <
    GroupName extends SheetApisGroupName,
    EndpointName extends SheetApisEndpointName<GroupName>,
    R = never,
  >(
    group: GroupName,
    endpoint: EndpointName,
    authorize?: (
      args: SheetApisProxyRequest<GroupName, EndpointName>,
    ) => Effect.Effect<void, SheetApisProxyError<GroupName, EndpointName>, R>,
    options?: {
      readonly unauthenticated?: "anonymous";
    },
  ): SheetApisProxyHandler<GroupName, EndpointName, R> =>
  (rawArgs) =>
    Effect.gen(function* () {
      const args = rawArgs as SheetApisProxyRequest<GroupName, EndpointName>;
      if (authorize) {
        yield* authorize(args);
      }

      const client = yield* SheetApisForwardingClient;
      const groupClient = client[group] as unknown as Record<string, SheetApisEndpointClient>;
      const endpointClient = groupClient?.[endpoint];
      if (typeof endpointClient !== "function") {
        return yield* Effect.die(
          new Error(`Unknown sheet-apis proxy target: ${group}.${endpoint}`),
        );
      }
      const proxied = endpointClient.call(groupClient, clientArgsFrom(args));
      const maybeUser = yield* Effect.serviceOption(SheetAuthUser);
      if (Option.isSome(maybeUser)) {
        return yield* proxied;
      }
      if (options?.unauthenticated === "anonymous") {
        return yield* proxied.pipe(
          Effect.provideService(SheetAuthUser, {
            accountId: "anonymous",
            userId: "anonymous",
            permissions: HashSet.empty(),
            token: Redacted.make("anonymous-token-unavailable"),
          }),
        );
      }
      const tokens = yield* SheetApisRpcTokens;
      const serviceUser = yield* tokens.getServiceUser();
      return yield* proxied.pipe(Effect.provideService(SheetAuthUser, serviceUser));
    }) as ReturnType<SheetApisProxyHandler<GroupName, EndpointName, R>>;

const requireService = () =>
  Effect.gen(function* () {
    const authorization = yield* AuthorizationService;
    yield* authorization.requireService();
  });

const requireNonService = () =>
  Effect.gen(function* () {
    const user = yield* SheetAuthUser;
    if (hasPermission(user.permissions, "service")) {
      return yield* Effect.fail(
        new Unauthorized({ message: "Service users cannot call Discord user endpoints" }),
      );
    }
  });

const requireGuild = (scope: "member" | "monitor" | "manage", guildId: string) =>
  Effect.gen(function* () {
    const authorization = yield* AuthorizationService;
    if (scope === "member") {
      yield* authorization.requireGuildMember(guildId);
    } else if (scope === "monitor") {
      yield* authorization.requireMonitorGuild(guildId);
    } else {
      yield* authorization.requireManageGuild(guildId);
    }
  });

const requireSelfOrMonitor = (guildId: string, accountId: string) =>
  Effect.gen(function* () {
    const authorization = yield* AuthorizationService;
    yield* authorization.requireDiscordAccountIdOrMonitorGuild(guildId, accountId);
  });

const requireMessageSlotRead = (messageId: string) =>
  Effect.gen(function* () {
    const messages = yield* MessageLookup;
    const record = yield* messages.getMessageSlotData(messageId);
    if (Option.isNone(record)) {
      return yield* Effect.fail(missingMessage("message slot data"));
    }
    const guildId = yield* getRequiredModernGuildId(record.value, "message slot");
    yield* requireGuild("member", guildId);
  }).pipe(Effect.mapError(authorizationArgumentError("message slot")));

const requireMessageSlotUpsert = (messageId: string, guildId?: string) =>
  Effect.gen(function* () {
    const messages = yield* MessageLookup;
    const existing = yield* messages.getMessageSlotData(messageId);
    const resolvedGuildId = Option.isSome(existing)
      ? yield* getRequiredModernGuildId(existing.value, "message slot")
      : typeof guildId === "string"
        ? guildId
        : yield* legacyDenied("message slot");
    yield* requireGuild("monitor", resolvedGuildId);
  }).pipe(Effect.mapError(authorizationUnauthorized("message slot")));

const requireRoomOrderMonitor = (messageId: string) =>
  Effect.gen(function* () {
    const messages = yield* MessageLookup;
    const record = yield* messages.getMessageRoomOrder(messageId);
    if (Option.isNone(record)) {
      return yield* Effect.fail(missingMessage("message room order"));
    }
    const guildId = yield* getRequiredModernGuildId(record.value, "message room order");
    yield* requireGuild("monitor", guildId);
  }).pipe(Effect.mapError(authorizationArgumentError("message room order")));

const requireRoomOrderUpsert = (messageId: string, guildId?: string) =>
  Effect.gen(function* () {
    const messages = yield* MessageLookup;
    const existing = yield* messages.getMessageRoomOrder(messageId);
    const resolvedGuildId = Option.isSome(existing)
      ? yield* getRequiredModernGuildId(existing.value, "message room order")
      : typeof guildId === "string"
        ? guildId
        : yield* legacyDenied("message room order");
    yield* requireGuild("monitor", resolvedGuildId);
  }).pipe(Effect.mapError(authorizationUnauthorized("message room order")));

const requireMessageCheckinRead = (messageId: string) =>
  Effect.gen(function* () {
    const authorization = yield* AuthorizationService;
    const messages = yield* MessageLookup;
    const user = yield* SheetAuthUser;
    const record = yield* messages.getMessageCheckinData(messageId);
    if (Option.isNone(record)) {
      return yield* Effect.fail(missingMessage("message checkin data"));
    }
    const guildId = yield* getRequiredModernGuildId(record.value, "message check-in");
    const accessLevel = yield* authorization.getCurrentGuildMonitorAccessLevel(guildId);
    if (accessLevel === "monitor") {
      return;
    }
    if (accessLevel !== "member") {
      return yield* Effect.fail(
        new Unauthorized({ message: "User is not a member of this guild" }),
      );
    }
    const members = yield* messages.getMessageCheckinMembers(messageId);
    if (!members.some((member) => member.memberId === user.accountId)) {
      return yield* Effect.fail(
        new Unauthorized({
          message: "User is not a recorded participant on this check-in message",
        }),
      );
    }
  }).pipe(Effect.mapError(authorizationArgumentError("message check-in")));

const getAuthorizedMessageCheckinMembers = (messageId: string) =>
  Effect.gen(function* () {
    const authorization = yield* AuthorizationService;
    const messages = yield* MessageLookup;
    const user = yield* SheetAuthUser;
    const record = yield* messages.getMessageCheckinData(messageId);
    if (Option.isNone(record)) {
      return yield* Effect.fail(missingMessage("message checkin data"));
    }
    const guildId = yield* getRequiredModernGuildId(record.value, "message check-in");
    const accessLevel = yield* authorization.getCurrentGuildMonitorAccessLevel(guildId);
    if (accessLevel === "monitor") {
      return yield* messages.getMessageCheckinMembers(messageId);
    }
    if (accessLevel !== "member") {
      return yield* Effect.fail(
        new Unauthorized({ message: "User is not a member of this guild" }),
      );
    }
    const members = yield* messages.getMessageCheckinMembers(messageId);
    if (!members.some((member) => member.memberId === user.accountId)) {
      return yield* Effect.fail(
        new Unauthorized({
          message: "User is not a recorded participant on this check-in message",
        }),
      );
    }
    return members;
  }).pipe(
    Effect.mapError((cause) =>
      cause instanceof Unauthorized
        ? cause
        : makeArgumentError("Cannot get message checkin members", cause),
    ),
  );

const requireMessageCheckinMonitor = (messageId: string) =>
  Effect.gen(function* () {
    const messages = yield* MessageLookup;
    const record = yield* messages.getMessageCheckinData(messageId);
    if (Option.isNone(record)) {
      return yield* Effect.fail(missingMessage("message checkin data"));
    }
    const guildId = yield* getRequiredModernGuildId(record.value, "message check-in");
    yield* requireGuild("monitor", guildId);
  }).pipe(Effect.mapError(authorizationArgumentError("message check-in")));

const requireMessageCheckinParticipantMutation = (messageId: string, memberId: string) =>
  Effect.gen(function* () {
    const messages = yield* MessageLookup;
    const user = yield* SheetAuthUser;
    const record = yield* messages.getMessageCheckinData(messageId);
    if (Option.isNone(record)) {
      return yield* Effect.fail(missingMessage("message checkin data"));
    }
    if (
      hasPermission(user.permissions, "service") ||
      hasPermission(user.permissions, "app_owner")
    ) {
      return;
    }
    const guildId = yield* getRequiredModernGuildId(record.value, "message check-in");
    const authorization = yield* AuthorizationService;
    if (!hasDiscordAccountPermission(user.permissions, memberId)) {
      return yield* Effect.fail(
        new Unauthorized({ message: "User does not have access to this user" }),
      );
    }
    yield* authorization.requireGuildMember(guildId);
    const members = yield* messages.getMessageCheckinMembers(messageId);
    if (!members.some((member) => member.memberId === memberId)) {
      return yield* Effect.fail(
        new Unauthorized({
          message: "User is not a recorded participant on this check-in message",
        }),
      );
    }
  }).pipe(Effect.mapError(authorizationArgumentError("message check-in participant")));

const requireMessageCheckinUpsert = (messageId: string, guildId?: string) =>
  Effect.gen(function* () {
    const messages = yield* MessageLookup;
    const existing = yield* messages.getMessageCheckinData(messageId);
    const resolvedGuildId = Option.isSome(existing)
      ? yield* getRequiredModernGuildId(existing.value, "message check-in")
      : typeof guildId === "string"
        ? guildId
        : yield* legacyDenied("message check-in");
    yield* requireGuild("monitor", resolvedGuildId);
  }).pipe(Effect.mapError(authorizationUnauthorized("message check-in")));

const requireDayPlayerSchedule = (guildId: string, accountId: string) =>
  Effect.gen(function* () {
    const authorization = yield* AuthorizationService;
    const resolvedUser = yield* authorization.resolveCurrentGuildUser(guildId);
    if (
      resolvedUser.accountId !== accountId &&
      !hasPermission(resolvedUser.permissions, "service") &&
      !hasPermission(resolvedUser.permissions, "app_owner") &&
      !hasGuildPermission(resolvedUser.permissions, "monitor_guild", guildId)
    ) {
      return yield* Effect.fail(
        new Unauthorized({ message: "User does not have access to this user" }),
      );
    }
  });

const makeApiLayer = () => {
  const ProxyLayers = Layer.mergeAll(
    HttpApiBuilder.group(Api, "calc", (handlers) =>
      handlers
        .handle("calcBot", proxySheetApis("calc", "calcBot", requireService))
        .handle(
          "calcSheet",
          proxySheetApis("calc", "calcSheet", undefined, { unauthenticated: "anonymous" }),
        ),
    ),
    HttpApiBuilder.group(Api, "checkin", (handlers) =>
      handlers.handle(
        "generate",
        proxySheetApis("checkin", "generate", ({ payload }) =>
          requireGuild("monitor", payload.guildId),
        ),
      ),
    ),
    HttpApiBuilder.group(Api, "discord", (handlers) =>
      handlers
        .handle("getCurrentUser", proxySheetApis("discord", "getCurrentUser", requireNonService))
        .handle(
          "getCurrentUserGuilds",
          proxySheetApis("discord", "getCurrentUserGuilds", requireNonService),
        ),
    ),
    HttpApiBuilder.group(Api, "guildConfig", (handlers) =>
      handlers
        .handle(
          "getAutoCheckinGuilds",
          proxySheetApis("guildConfig", "getAutoCheckinGuilds", requireService),
        )
        .handle(
          "getGuildConfig",
          proxySheetApis("guildConfig", "getGuildConfig", ({ query }) =>
            requireGuild("manage", query.guildId),
          ),
        )
        .handle(
          "upsertGuildConfig",
          proxySheetApis("guildConfig", "upsertGuildConfig", ({ payload }) =>
            requireGuild("manage", payload.guildId),
          ),
        )
        .handle(
          "getGuildMonitorRoles",
          proxySheetApis("guildConfig", "getGuildMonitorRoles", ({ query }) =>
            requireGuild("member", query.guildId),
          ),
        )
        .handle(
          "getGuildChannels",
          proxySheetApis("guildConfig", "getGuildChannels", ({ query }) =>
            requireGuild("member", query.guildId),
          ),
        )
        .handle(
          "addGuildMonitorRole",
          proxySheetApis("guildConfig", "addGuildMonitorRole", ({ payload }) =>
            requireGuild("manage", payload.guildId),
          ),
        )
        .handle(
          "removeGuildMonitorRole",
          proxySheetApis("guildConfig", "removeGuildMonitorRole", ({ payload }) =>
            requireGuild("manage", payload.guildId),
          ),
        )
        .handle(
          "upsertGuildChannelConfig",
          proxySheetApis("guildConfig", "upsertGuildChannelConfig", ({ payload }) =>
            requireGuild("manage", payload.guildId),
          ),
        )
        .handle(
          "getGuildChannelById",
          proxySheetApis("guildConfig", "getGuildChannelById", ({ query }) =>
            requireGuild("member", query.guildId),
          ),
        )
        .handle(
          "getGuildChannelByName",
          proxySheetApis("guildConfig", "getGuildChannelByName", ({ query }) =>
            requireGuild("member", query.guildId),
          ),
        ),
    ),
    HttpApiBuilder.group(Api, "messageCheckin", (handlers) =>
      handlers
        .handle(
          "getMessageCheckinData",
          proxySheetApis("messageCheckin", "getMessageCheckinData", ({ query }) =>
            requireMessageCheckinRead(query.messageId),
          ),
        )
        .handle(
          "upsertMessageCheckinData",
          proxySheetApis("messageCheckin", "upsertMessageCheckinData", ({ payload }) =>
            requireMessageCheckinUpsert(
              payload.messageId,
              typeof payload.data.guildId === "string" ? payload.data.guildId : undefined,
            ),
          ),
        )
        .handle("getMessageCheckinMembers", ({ query }) =>
          getAuthorizedMessageCheckinMembers(query.messageId),
        )
        .handle(
          "addMessageCheckinMembers",
          proxySheetApis("messageCheckin", "addMessageCheckinMembers", ({ payload }) =>
            requireMessageCheckinMonitor(payload.messageId),
          ),
        )
        .handle(
          "setMessageCheckinMemberCheckinAt",
          proxySheetApis("messageCheckin", "setMessageCheckinMemberCheckinAt", ({ payload }) =>
            requireMessageCheckinParticipantMutation(payload.messageId, payload.memberId),
          ),
        )
        .handle(
          "removeMessageCheckinMember",
          proxySheetApis("messageCheckin", "removeMessageCheckinMember", ({ payload }) =>
            requireMessageCheckinParticipantMutation(payload.messageId, payload.memberId),
          ),
        ),
    ),
    HttpApiBuilder.group(Api, "messageRoomOrder", (handlers) =>
      handlers
        .handle(
          "getMessageRoomOrder",
          proxySheetApis("messageRoomOrder", "getMessageRoomOrder", ({ query }) =>
            requireRoomOrderMonitor(query.messageId),
          ),
        )
        .handle(
          "upsertMessageRoomOrder",
          proxySheetApis("messageRoomOrder", "upsertMessageRoomOrder", ({ payload }) =>
            requireRoomOrderUpsert(
              payload.messageId,
              typeof payload.data.guildId === "string" ? payload.data.guildId : undefined,
            ),
          ),
        )
        .handle(
          "persistMessageRoomOrder",
          proxySheetApis("messageRoomOrder", "persistMessageRoomOrder", ({ payload }) =>
            requireRoomOrderUpsert(
              payload.messageId,
              typeof payload.data.guildId === "string" ? payload.data.guildId : undefined,
            ),
          ),
        )
        .handle(
          "decrementMessageRoomOrderRank",
          proxySheetApis("messageRoomOrder", "decrementMessageRoomOrderRank", ({ payload }) =>
            requireRoomOrderMonitor(payload.messageId),
          ),
        )
        .handle(
          "incrementMessageRoomOrderRank",
          proxySheetApis("messageRoomOrder", "incrementMessageRoomOrderRank", ({ payload }) =>
            requireRoomOrderMonitor(payload.messageId),
          ),
        )
        .handle(
          "getMessageRoomOrderEntry",
          proxySheetApis("messageRoomOrder", "getMessageRoomOrderEntry", ({ query }) =>
            requireRoomOrderMonitor(query.messageId),
          ),
        )
        .handle(
          "getMessageRoomOrderRange",
          proxySheetApis("messageRoomOrder", "getMessageRoomOrderRange", ({ query }) =>
            requireRoomOrderMonitor(query.messageId),
          ),
        )
        .handle(
          "upsertMessageRoomOrderEntry",
          proxySheetApis("messageRoomOrder", "upsertMessageRoomOrderEntry", ({ payload }) =>
            requireRoomOrderMonitor(payload.messageId),
          ),
        )
        .handle(
          "removeMessageRoomOrderEntry",
          proxySheetApis("messageRoomOrder", "removeMessageRoomOrderEntry", ({ payload }) =>
            requireRoomOrderMonitor(payload.messageId),
          ),
        ),
    ),
    HttpApiBuilder.group(Api, "messageSlot", (handlers) =>
      handlers
        .handle(
          "getMessageSlotData",
          proxySheetApis("messageSlot", "getMessageSlotData", ({ query }) =>
            requireMessageSlotRead(query.messageId),
          ),
        )
        .handle(
          "upsertMessageSlotData",
          proxySheetApis("messageSlot", "upsertMessageSlotData", ({ payload }) =>
            requireMessageSlotUpsert(
              payload.messageId,
              typeof payload.data.guildId === "string" ? payload.data.guildId : undefined,
            ),
          ),
        ),
    ),
    HttpApiBuilder.group(Api, "monitor", (handlers) =>
      handlers
        .handle(
          "getMonitorMaps",
          proxySheetApis("monitor", "getMonitorMaps", ({ query }) =>
            requireGuild("monitor", query.guildId),
          ),
        )
        .handle(
          "getByIds",
          proxySheetApis("monitor", "getByIds", ({ query }) =>
            requireGuild("monitor", query.guildId),
          ),
        )
        .handle(
          "getByNames",
          proxySheetApis("monitor", "getByNames", ({ query }) =>
            requireGuild("monitor", query.guildId),
          ),
        ),
    ),
    HttpApiBuilder.group(Api, "permissions", (handlers) =>
      handlers.handle(
        "getCurrentUserPermissions",
        Effect.fnUntraced(function* ({ query }) {
          const authorization = yield* AuthorizationService;
          const resolvedUser =
            typeof query.guildId === "string"
              ? yield* authorization.resolveCurrentGuildUser(query.guildId)
              : yield* SheetAuthUser;

          return {
            permissions: resolvedUser.permissions,
          };
        }),
      ),
    ),
    HttpApiBuilder.group(Api, "player", (handlers) =>
      handlers
        .handle(
          "getPlayerMaps",
          proxySheetApis("player", "getPlayerMaps", ({ query }) =>
            requireGuild("monitor", query.guildId),
          ),
        )
        .handle(
          "getByIds",
          proxySheetApis("player", "getByIds", ({ query }) =>
            query.ids.length === 1
              ? requireSelfOrMonitor(query.guildId, query.ids[0])
              : requireGuild("monitor", query.guildId),
          ),
        )
        .handle(
          "getByNames",
          proxySheetApis("player", "getByNames", ({ query }) =>
            requireGuild("monitor", query.guildId),
          ),
        )
        .handle(
          "getTeamsByIds",
          proxySheetApis("player", "getTeamsByIds", ({ query }) =>
            query.ids.length === 1
              ? requireSelfOrMonitor(query.guildId, query.ids[0])
              : requireGuild("monitor", query.guildId),
          ),
        )
        .handle(
          "getTeamsByNames",
          proxySheetApis("player", "getTeamsByNames", ({ query }) =>
            requireGuild("monitor", query.guildId),
          ),
        ),
    ),
    HttpApiBuilder.group(Api, "roomOrder", (handlers) =>
      handlers.handle(
        "generate",
        proxySheetApis("roomOrder", "generate", ({ payload }) =>
          requireGuild("monitor", payload.guildId),
        ),
      ),
    ),
    HttpApiBuilder.group(Api, "schedule", (handlers) =>
      handlers
        .handle(
          "getAllPopulatedSchedules",
          proxySheetApis("schedule", "getAllPopulatedSchedules", ({ query }) =>
            requireGuild("member", query.guildId),
          ),
        )
        .handle(
          "getDayPopulatedSchedules",
          proxySheetApis("schedule", "getDayPopulatedSchedules", ({ query }) =>
            requireGuild("member", query.guildId),
          ),
        )
        .handle(
          "getChannelPopulatedSchedules",
          proxySheetApis("schedule", "getChannelPopulatedSchedules", ({ query }) =>
            requireGuild("member", query.guildId),
          ),
        )
        .handle(
          "getDayPlayerSchedule",
          proxySheetApis("schedule", "getDayPlayerSchedule", ({ query }) =>
            requireDayPlayerSchedule(query.guildId, query.accountId),
          ),
        ),
    ),
    HttpApiBuilder.group(Api, "screenshot", (handlers) =>
      handlers.handle(
        "getScreenshot",
        proxySheetApis("screenshot", "getScreenshot", ({ query }) =>
          requireGuild("monitor", query.guildId),
        ),
      ),
    ),
    HttpApiBuilder.group(Api, "sheet", (handlers) =>
      handlers
        .handle("getPlayers", proxySheetApis("sheet", "getPlayers", requireService))
        .handle("getMonitors", proxySheetApis("sheet", "getMonitors", requireService))
        .handle("getTeams", proxySheetApis("sheet", "getTeams", requireService))
        .handle("getAllSchedules", proxySheetApis("sheet", "getAllSchedules", requireService))
        .handle("getDaySchedules", proxySheetApis("sheet", "getDaySchedules", requireService))
        .handle(
          "getChannelSchedules",
          proxySheetApis("sheet", "getChannelSchedules", requireService),
        )
        .handle("getRangesConfig", proxySheetApis("sheet", "getRangesConfig", requireService))
        .handle("getTeamConfig", proxySheetApis("sheet", "getTeamConfig", requireService))
        .handle("getEventConfig", proxySheetApis("sheet", "getEventConfig", requireService))
        .handle("getScheduleConfig", proxySheetApis("sheet", "getScheduleConfig", requireService))
        .handle("getRunnerConfig", proxySheetApis("sheet", "getRunnerConfig", requireService)),
    ),
    HttpApiBuilder.group(Api, "application", (handlers) =>
      handlers.handle("getApplication", proxySheetBot("application", "getApplication")),
    ),
    HttpApiBuilder.group(Api, "cache", (handlers) =>
      handlers
        .handle("getGuild", proxySheetBot("cache", "getGuild"))
        .handle("getGuildSize", proxySheetBot("cache", "getGuildSize"))
        .handle("getChannel", proxySheetBot("cache", "getChannel"))
        .handle("getRole", proxySheetBot("cache", "getRole"))
        .handle("getMember", proxySheetBot("cache", "getMember"))
        .handle("getChannelsForParent", proxySheetBot("cache", "getChannelsForParent"))
        .handle("getRolesForParent", proxySheetBot("cache", "getRolesForParent"))
        .handle("getMembersForParent", proxySheetBot("cache", "getMembersForParent"))
        .handle("getChannelsForResource", proxySheetBot("cache", "getChannelsForResource"))
        .handle("getRolesForResource", proxySheetBot("cache", "getRolesForResource"))
        .handle("getMembersForResource", proxySheetBot("cache", "getMembersForResource"))
        .handle("getChannelsSize", proxySheetBot("cache", "getChannelsSize"))
        .handle("getRolesSize", proxySheetBot("cache", "getRolesSize"))
        .handle("getMembersSize", proxySheetBot("cache", "getMembersSize"))
        .handle("getChannelsSizeForParent", proxySheetBot("cache", "getChannelsSizeForParent"))
        .handle("getRolesSizeForParent", proxySheetBot("cache", "getRolesSizeForParent"))
        .handle("getMembersSizeForParent", proxySheetBot("cache", "getMembersSizeForParent"))
        .handle("getChannelsSizeForResource", proxySheetBot("cache", "getChannelsSizeForResource"))
        .handle("getRolesSizeForResource", proxySheetBot("cache", "getRolesSizeForResource"))
        .handle("getMembersSizeForResource", proxySheetBot("cache", "getMembersSizeForResource")),
    ),
  );

  return HttpApiBuilder.layer(Api).pipe(
    Layer.provide(ProxyLayers),
    Layer.merge(HttpApiSwagger.layer(Api)),
    Layer.merge(HttpRouter.add("GET", "/health", HttpServerResponse.empty({ status: 200 }))),
    Layer.provide(corsMiddlewareLayer),
    Layer.provide([
      SheetAuthTokenAuthorizationLive,
      AuthorizationService.layer,
      MessageLookup.layer,
      SheetApisForwardingClient.layer,
      SheetApisRpcTokens.layer,
      SheetBotForwardingClient.layer,
    ]),
  );
};

const configProviderLayer = Layer.unwrap(
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    return yield* fs.readFileString(".env").pipe(
      Effect.map((content) =>
        ConfigProvider.layerAdd(ConfigProvider.fromDotEnvContents(content)).pipe(
          Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnv())),
        ),
      ),
      Effect.catch((error) =>
        Effect.logWarning(
          "Could not read .env file, falling back to environment variables",
          error,
        ).pipe(Effect.as(ConfigProvider.layer(ConfigProvider.fromEnv()))),
      ),
    );
  }),
).pipe(Layer.provide(NodeFileSystem.layer));

const HttpLive = Layer.unwrap(
  Effect.gen(function* () {
    const port = yield* config.port;
    const ApiLayer = makeApiLayer();

    return HttpRouter.serve(ApiLayer).pipe(
      HttpServer.withLogAddress,
      Layer.provide(ServiceTokenAuthorizer.layer),
      Layer.provide(NodeHttpServer.layer(createServer, { port })),
    );
  }),
);

const MainLive = HttpLive.pipe(
  Layer.provide(TelemetryLive),
  Layer.provide(Logger.layer([Logger.consoleLogFmt])),
  Layer.provide(NodeHttpClient.layerFetch),
  Layer.provide(configProviderLayer),
) as Layer.Layer<never, never, never>;

Layer.launch(MainLive).pipe(NodeRuntime.runMain);
