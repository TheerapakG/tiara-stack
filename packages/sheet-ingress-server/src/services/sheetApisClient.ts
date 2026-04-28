import { Headers, HttpClient } from "effect/unstable/http";
import { RpcClient, RpcSerialization } from "effect/unstable/rpc";
import { NodeFileSystem } from "@effect/platform-node";
import {
  Array,
  Cache,
  Context,
  DateTime,
  Duration,
  Effect,
  Exit,
  FileSystem,
  HashSet,
  Layer,
  Option,
  pipe,
  Redacted,
  Ref,
  Schedule,
} from "effect";
import { createKubernetesOAuthSession, getDiscordAccessToken } from "sheet-auth/client";
import { DISCORD_SERVICE_USER_ID_SENTINEL } from "sheet-auth/plugins/kubernetes-oauth";
import { SheetApisRpcs } from "sheet-ingress-api/sheet-apis-rpc";
import { SheetAuthUser } from "sheet-ingress-api/schemas/middlewares/sheetAuthUser";
import { Unauthorized } from "sheet-ingress-api/schemas/middlewares/unauthorized";
import { config } from "@/config";
import { SheetAuthClient } from "./sheetAuthClient";

const sheetAuthTokenPath = "/var/run/secrets/tokens/sheet-auth-token";
const sheetApisTokenPath = "/var/run/secrets/tokens/sheet-apis-token";

type SheetAuthUserType = Context.Service.Shape<typeof SheetAuthUser>;

type TokenCacheEntry = {
  readonly token: Redacted.Redacted<string> | undefined;
  readonly userId: string | undefined;
  readonly timeToLive: Duration.Duration;
};

const forwardDiscordAccessTokenTag = Context.Reference<boolean>("ForwardDiscordAccessToken", {
  defaultValue: () => false,
});

export class SheetApisClient extends Context.Service<SheetApisClient>()("SheetApisClient", {
  make: Effect.gen(function* () {
    const baseUrl = yield* config.sheetApisBaseUrl;
    const httpClient = yield* HttpClient.HttpClient;
    const fs = yield* FileSystem.FileSystem;
    const sheetAuthClient = yield* SheetAuthClient;
    const k8sTokenRef = yield* Ref.make("");
    const sheetApisTokenRef = yield* Ref.make("");

    const refreshToken = (tokenPath: string, tokenName: string, tokenRef: Ref.Ref<string>) =>
      pipe(
        fs.readFileString(tokenPath, "utf-8"),
        Effect.map((token) => token.trim()),
        Effect.flatMap((token) =>
          token.length > 0
            ? Ref.set(tokenRef, token)
            : Effect.fail(new Error(`${tokenName} Kubernetes token file is empty`)),
        ),
        Effect.retry({ schedule: Schedule.exponential("1 second"), times: 3 }),
      );

    const refreshK8sToken = refreshToken(sheetAuthTokenPath, "sheet-auth", k8sTokenRef);

    yield* refreshK8sToken.pipe(
      Effect.tapError((error) =>
        Effect.logError("Failed to initialize sheet-auth Kubernetes token", error),
      ),
    );
    yield* refreshK8sToken.pipe(
      Effect.catch((error) =>
        Effect.logWarning("Failed to refresh sheet-auth Kubernetes token", error),
      ),
      Effect.repeat(Schedule.spaced("5 minutes")),
      Effect.forkScoped,
    );

    const refreshSheetApisToken = refreshToken(sheetApisTokenPath, "sheet-apis", sheetApisTokenRef);

    yield* refreshSheetApisToken.pipe(
      Effect.tapError((error) =>
        Effect.logError("Failed to initialize sheet-apis Kubernetes token", error),
      ),
    );
    yield* refreshSheetApisToken.pipe(
      Effect.catch((error) =>
        Effect.logWarning("Failed to refresh sheet-apis Kubernetes token", error),
      ),
      Effect.repeat(Schedule.spaced("5 minutes")),
      Effect.forkScoped,
    );

    const serviceUserTokenCache = yield* Cache.makeWith<string, TokenCacheEntry>(
      Effect.fn("SheetApisClient.lookupServiceUserToken")(function* () {
        const k8sToken = yield* Ref.get(k8sTokenRef);
        const session = yield* createKubernetesOAuthSession(
          sheetAuthClient,
          DISCORD_SERVICE_USER_ID_SENTINEL,
          k8sToken,
        ).pipe(
          Effect.catch((error) =>
            Effect.logWarning("Failed to create service-user auth session", error).pipe(
              Effect.as(undefined),
            ),
          ),
        );
        const now = yield* DateTime.now;
        const timeToLive = session?.session?.expiresAt
          ? Duration.max(
              pipe(
                DateTime.distance(now, session.session.expiresAt),
                Duration.subtract(Duration.seconds(60)),
              ),
              Duration.seconds(15),
            )
          : Duration.minutes(1);

        return {
          token: session?.token,
          userId: session?.session?.userId,
          timeToLive,
        };
      }),
      {
        capacity: 1,
        timeToLive: Exit.match({
          onFailure: () => Duration.minutes(1),
          onSuccess: ({ timeToLive }) => timeToLive,
        }),
      },
    );

    const getServiceUser = Effect.fn("SheetApisClient.getServiceUser")(function* () {
      const { token, userId } = yield* Cache.get(
        serviceUserTokenCache,
        DISCORD_SERVICE_USER_ID_SENTINEL,
      );

      if (!token || !userId) {
        return yield* Effect.fail(new Error("Failed to create service-user auth session"));
      }

      return {
        accountId: DISCORD_SERVICE_USER_ID_SENTINEL,
        userId,
        permissions: HashSet.fromIterable(["service"]),
        token,
      } satisfies SheetAuthUserType;
    });

    const discordAccessTokenCache = yield* Cache.makeWith(
      (token: Redacted.Redacted<string>) =>
        getDiscordAccessToken(sheetAuthClient, {
          Authorization: `Bearer ${Redacted.value(token)}`,
        }).pipe(Effect.map(({ accessToken }) => accessToken)),
      {
        capacity: 10_000,
        timeToLive: Exit.match({
          onFailure: () => Duration.seconds(30),
          onSuccess: () => Duration.minutes(5),
        }),
      },
    );

    const getForwardedHeaders = Effect.fn("SheetApisClient.getForwardedHeaders")(function* () {
      const user = yield* SheetAuthUser;
      const forwardDiscordAccessToken = yield* forwardDiscordAccessTokenTag;
      const sheetApisToken = yield* Ref.get(sheetApisTokenRef);
      let headers = pipe(
        Headers.set(Headers.empty, "x-sheet-ingress-auth", `Bearer ${sheetApisToken}`),
        Headers.set("x-sheet-auth-user-id", user.userId),
        Headers.set("x-sheet-auth-account-id", user.accountId),
        Headers.set("x-sheet-auth-permissions", Array.fromIterable(user.permissions).join(",")),
      );

      const maybeDiscordAccessToken =
        !forwardDiscordAccessToken ||
        HashSet.has(user.permissions, "service") ||
        user.accountId === "anonymous"
          ? Option.none()
          : yield* Cache.get(discordAccessTokenCache, user.token).pipe(
              Effect.map(Option.some),
              Effect.mapError(
                (cause) =>
                  new Unauthorized({
                    message: "Invalid Discord access token",
                    cause,
                  }),
              ),
            );

      if (Option.isSome(maybeDiscordAccessToken)) {
        headers = Headers.set(
          headers,
          "x-sheet-discord-access-token",
          Redacted.value(maybeDiscordAccessToken.value),
        );
      }

      return headers;
    });

    const rpcUrl = `${baseUrl.replace(/\/$/, "")}/rpc`;
    const rpcClient = yield* RpcClient.make(SheetApisRpcs).pipe(
      Effect.provide(RpcClient.layerProtocolHttp({ url: rpcUrl })),
      Effect.provide(RpcSerialization.layerJson),
      Effect.provideService(HttpClient.HttpClient, httpClient),
    );

    const withForwardedHeaders = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
      Effect.gen(function* () {
        const headers = yield* getForwardedHeaders();
        return yield* effect.pipe(RpcClient.withHeaders(headers));
      });

    const call =
      <Input, A, E, R>(fn: (args: Input) => Effect.Effect<A, E, R>) =>
      (args: Input) =>
        withForwardedHeaders(fn(args));
    const callNoInput =
      <A, E, R>(fn: (args: undefined) => Effect.Effect<A, E, R>) =>
      () =>
        withForwardedHeaders(fn(undefined));

    return {
      calc: {
        calcBot: call(rpcClient["calc.calcBot"]),
        calcSheet: call(rpcClient["calc.calcSheet"]),
      },
      checkin: {
        generate: call(rpcClient["checkin.generate"]),
      },
      discord: {
        getCurrentUser: callNoInput(rpcClient["discord.getCurrentUser"]),
        getCurrentUserGuilds: callNoInput(rpcClient["discord.getCurrentUserGuilds"]),
      },
      guildConfig: {
        getAutoCheckinGuilds: callNoInput(rpcClient["guildConfig.getAutoCheckinGuilds"]),
        getGuildConfig: call(rpcClient["guildConfig.getGuildConfig"]),
        upsertGuildConfig: call(rpcClient["guildConfig.upsertGuildConfig"]),
        getGuildMonitorRoles: call(rpcClient["guildConfig.getGuildMonitorRoles"]),
        getGuildChannels: call(rpcClient["guildConfig.getGuildChannels"]),
        addGuildMonitorRole: call(rpcClient["guildConfig.addGuildMonitorRole"]),
        removeGuildMonitorRole: call(rpcClient["guildConfig.removeGuildMonitorRole"]),
        upsertGuildChannelConfig: call(rpcClient["guildConfig.upsertGuildChannelConfig"]),
        getGuildChannelById: call(rpcClient["guildConfig.getGuildChannelById"]),
        getGuildChannelByName: call(rpcClient["guildConfig.getGuildChannelByName"]),
      },
      messageCheckin: {
        getMessageCheckinData: call(rpcClient["messageCheckin.getMessageCheckinData"]),
        upsertMessageCheckinData: call(rpcClient["messageCheckin.upsertMessageCheckinData"]),
        getMessageCheckinMembers: call(rpcClient["messageCheckin.getMessageCheckinMembers"]),
        addMessageCheckinMembers: call(rpcClient["messageCheckin.addMessageCheckinMembers"]),
        setMessageCheckinMemberCheckinAt: call(
          rpcClient["messageCheckin.setMessageCheckinMemberCheckinAt"],
        ),
        removeMessageCheckinMember: call(rpcClient["messageCheckin.removeMessageCheckinMember"]),
      },
      messageRoomOrder: {
        getMessageRoomOrder: call(rpcClient["messageRoomOrder.getMessageRoomOrder"]),
        upsertMessageRoomOrder: call(rpcClient["messageRoomOrder.upsertMessageRoomOrder"]),
        persistMessageRoomOrder: call(rpcClient["messageRoomOrder.persistMessageRoomOrder"]),
        decrementMessageRoomOrderRank: call(
          rpcClient["messageRoomOrder.decrementMessageRoomOrderRank"],
        ),
        incrementMessageRoomOrderRank: call(
          rpcClient["messageRoomOrder.incrementMessageRoomOrderRank"],
        ),
        getMessageRoomOrderEntry: call(rpcClient["messageRoomOrder.getMessageRoomOrderEntry"]),
        getMessageRoomOrderRange: call(rpcClient["messageRoomOrder.getMessageRoomOrderRange"]),
        upsertMessageRoomOrderEntry: call(
          rpcClient["messageRoomOrder.upsertMessageRoomOrderEntry"],
        ),
        removeMessageRoomOrderEntry: call(
          rpcClient["messageRoomOrder.removeMessageRoomOrderEntry"],
        ),
      },
      messageSlot: {
        getMessageSlotData: call(rpcClient["messageSlot.getMessageSlotData"]),
        upsertMessageSlotData: call(rpcClient["messageSlot.upsertMessageSlotData"]),
      },
      monitor: {
        getMonitorMaps: call(rpcClient["monitor.getMonitorMaps"]),
        getByIds: call(rpcClient["monitor.getByIds"]),
        getByNames: call(rpcClient["monitor.getByNames"]),
      },
      permissions: {
        getCurrentUserPermissions: call(rpcClient["permissions.getCurrentUserPermissions"]),
      },
      player: {
        getPlayerMaps: call(rpcClient["player.getPlayerMaps"]),
        getByIds: call(rpcClient["player.getByIds"]),
        getByNames: call(rpcClient["player.getByNames"]),
        getTeamsByIds: call(rpcClient["player.getTeamsByIds"]),
        getTeamsByNames: call(rpcClient["player.getTeamsByNames"]),
      },
      roomOrder: {
        generate: call(rpcClient["roomOrder.generate"]),
      },
      schedule: {
        getAllPopulatedSchedules: call(rpcClient["schedule.getAllPopulatedSchedules"]),
        getDayPopulatedSchedules: call(rpcClient["schedule.getDayPopulatedSchedules"]),
        getChannelPopulatedSchedules: call(rpcClient["schedule.getChannelPopulatedSchedules"]),
        getDayPlayerSchedule: call(rpcClient["schedule.getDayPlayerSchedule"]),
      },
      screenshot: {
        getScreenshot: call(rpcClient["screenshot.getScreenshot"]),
      },
      sheet: {
        getPlayers: call(rpcClient["sheet.getPlayers"]),
        getMonitors: call(rpcClient["sheet.getMonitors"]),
        getTeams: call(rpcClient["sheet.getTeams"]),
        getAllSchedules: call(rpcClient["sheet.getAllSchedules"]),
        getDaySchedules: call(rpcClient["sheet.getDaySchedules"]),
        getChannelSchedules: call(rpcClient["sheet.getChannelSchedules"]),
        getRangesConfig: call(rpcClient["sheet.getRangesConfig"]),
        getTeamConfig: call(rpcClient["sheet.getTeamConfig"]),
        getEventConfig: call(rpcClient["sheet.getEventConfig"]),
        getScheduleConfig: call(rpcClient["sheet.getScheduleConfig"]),
        getRunnerConfig: call(rpcClient["sheet.getRunnerConfig"]),
      },
      getServiceUser,
      withServiceUser: <A, E, R>(effect: Effect.Effect<A, E, R>) =>
        Effect.gen(function* () {
          const serviceUser = yield* getServiceUser();
          return yield* effect.pipe(Effect.provideService(SheetAuthUser, serviceUser));
        }),
      withDiscordAccessToken: <A, E, R>(effect: Effect.Effect<A, E, R>) =>
        effect.pipe(Effect.provideService(forwardDiscordAccessTokenTag, true)),
    };
  }),
}) {
  static layer = Layer.effect(SheetApisClient, this.make).pipe(
    Layer.provide([SheetAuthClient.layer, NodeFileSystem.layer]),
  );
}
