import { describe, expect, it } from "@effect/vitest";
import { Deferred, Effect, Layer, Schema } from "effect";
import type { RoomOrderPinTentativeButtonPayload } from "sheet-ingress-api/sheet-apis-rpc";
import {
  DispatchJobTerminalUpdateRejectedError,
  DispatchJobs,
  IngressBotClient,
  type DispatchJob,
} from "@/services";
import { decodeRoomOrderPinTentativeStoredPayload, runTracked } from "./dispatchEntities";

const job: DispatchJob = {
  dispatchRequestId: "button:checkinButton:message-1:dispatch-1",
  entityType: "dispatchMessage",
  entityId: "message:message-1",
  operation: "checkinButton",
  status: "failed",
  runId: null,
  payload: {},
  result: null,
  error: { _tag: "DispatchExecutionFailure" },
  createdAt: new Date(),
};

const DispatchResult = Schema.Struct({
  ok: Schema.Boolean,
});
const DispatchEntityResult = Schema.Union([DispatchResult, Schema.Void]);

const claimedJob: DispatchJob = {
  ...job,
  status: "running",
  runId: "00000000-0000-4000-8000-000000000001",
  error: null,
};
const runId = "00000000-0000-4000-8000-000000000001";
const currentRunId = "00000000-0000-4000-8000-000000000002";

const roomOrderPinTentativePayload: RoomOrderPinTentativeButtonPayload = {
  guildId: "guild-1",
  messageId: "message-1",
  messageChannelId: "channel-1",
  interactionToken: "interaction-token",
  interactionDeadlineEpochMs: Date.now() + 60_000,
};

describe("dispatch entities", () => {
  it.effect("recovers legacy pin-tentative payloads without an authorization snapshot", () =>
    Effect.gen(function* () {
      const decoded = yield* decodeRoomOrderPinTentativeStoredPayload({
        requester: { accountId: "account-1", userId: "user-1" },
        payload: roomOrderPinTentativePayload,
      });

      expect(decoded).toEqual({
        requester: { accountId: "account-1", userId: "user-1" },
        payload: roomOrderPinTentativePayload,
      });
    }),
  );

  it.effect("rejects incompatible decoded pin-tentative snapshots during recovery", () =>
    Effect.gen(function* () {
      const error = yield* decodeRoomOrderPinTentativeStoredPayload({
        requester: { accountId: "account-1", userId: "user-1" },
        payload: roomOrderPinTentativePayload,
        authorizedRoomOrder: {
          messageId: "message-1",
          hour: 20,
          previousFills: [],
          fills: [],
          rank: 0,
          tentative: true,
          monitor: { _id: "Option", _tag: "None" },
          guildId: { _id: "Option", _tag: "Some", value: "guild-1" },
          messageChannelId: { _id: "Option", _tag: "Some", value: "channel-1" },
        },
      }).pipe(Effect.flip);

      expect(error).toBeDefined();
    }),
  );

  it.effect("acknowledges already failed job redelivery without rerunning work", () =>
    Effect.gen(function* () {
      let executed = false;

      const exit = yield* Effect.exit(
        runTracked({
          dispatchRequestId: job.dispatchRequestId,
          successSchema: DispatchEntityResult,
          effect: Effect.sync(() => {
            executed = true;
            return { ok: true };
          }),
        }).pipe(
          Effect.provide(
            Layer.mergeAll(
              Layer.succeed(DispatchJobs)({
                acceptCreation: () => Effect.die("unexpected accept"),
                acceptButton: () => Effect.die("unexpected accept"),
                claimRunning: () => Effect.succeed({ _tag: "alreadyFailed", job }),
                get: () => Effect.succeed(job),
                markEnqueueFailed: () => Effect.die("unexpected enqueue mark"),
                recoverRunnable: () => Effect.die("unexpected recovery"),
                retryFailedCreation: () => Effect.die("unexpected retry"),
                heartbeatRunning: () => Effect.die("unexpected heartbeat"),
                markSucceeded: () => Effect.die("unexpected success mark"),
                markFailed: () => Effect.die("unexpected failed mark"),
              }),
              Layer.succeed(IngressBotClient)({} as never),
            ),
          ),
        ),
      );

      expect(exit._tag).toBe("Success");
      expect(executed).toBe(false);
    }),
  );

  it.effect("acknowledges invalid already succeeded job redelivery without rerunning work", () =>
    Effect.gen(function* () {
      let executed = false;
      const succeededJob = {
        ...job,
        status: "succeeded" as const,
        result: { ok: "not-boolean" },
        error: null,
      };

      const result = yield* runTracked({
        dispatchRequestId: job.dispatchRequestId,
        successSchema: DispatchEntityResult,
        effect: Effect.sync(() => {
          executed = true;
          return { ok: true };
        }),
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            Layer.succeed(DispatchJobs)({
              acceptCreation: () => Effect.die("unexpected accept"),
              acceptButton: () => Effect.die("unexpected accept"),
              claimRunning: () => Effect.succeed({ _tag: "alreadySucceeded", job: succeededJob }),
              get: () => Effect.succeed(succeededJob),
              markEnqueueFailed: () => Effect.die("unexpected enqueue mark"),
              recoverRunnable: () => Effect.die("unexpected recovery"),
              retryFailedCreation: () => Effect.die("unexpected retry"),
              heartbeatRunning: () => Effect.die("unexpected heartbeat"),
              markSucceeded: () => Effect.die("unexpected success mark"),
              markFailed: () => Effect.die("unexpected failed mark"),
            }),
            Layer.succeed(IngressBotClient)({} as never),
          ),
        ),
      );

      expect(result).toBeUndefined();
      expect(executed).toBe(false);
    }),
  );

  it.effect("acknowledges redelivery when another run keeps owning the dispatch job", () =>
    Effect.gen(function* () {
      let executed = false;

      const result = yield* runTracked({
        alreadyRunningMaxRetries: 0,
        dispatchRequestId: job.dispatchRequestId,
        successSchema: DispatchEntityResult,
        effect: Effect.sync(() => {
          executed = true;
          return { ok: true };
        }),
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            Layer.succeed(DispatchJobs)({
              acceptCreation: () => Effect.die("unexpected accept"),
              acceptButton: () => Effect.die("unexpected accept"),
              claimRunning: () => Effect.succeed({ _tag: "alreadyRunning", job: claimedJob }),
              get: () => Effect.succeed(claimedJob),
              markEnqueueFailed: () => Effect.die("unexpected enqueue mark"),
              recoverRunnable: () => Effect.die("unexpected recovery"),
              retryFailedCreation: () => Effect.die("unexpected retry"),
              heartbeatRunning: () => Effect.die("unexpected heartbeat"),
              markSucceeded: () => Effect.die("unexpected success mark"),
              markFailed: () => Effect.die("unexpected failed mark"),
            }),
            Layer.succeed(IngressBotClient)({} as never),
          ),
        ),
      );

      expect(result).toBeUndefined();
      expect(executed).toBe(false);
    }),
  );

  it.effect("acknowledges stale successful runners when terminal update is rejected", () =>
    Effect.gen(function* () {
      const result = yield* runTracked({
        dispatchRequestId: job.dispatchRequestId,
        successSchema: DispatchEntityResult,
        effect: Effect.succeed({ ok: true }),
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            Layer.succeed(DispatchJobs)({
              acceptCreation: () => Effect.die("unexpected accept"),
              acceptButton: () => Effect.die("unexpected accept"),
              claimRunning: () =>
                Effect.succeed({
                  _tag: "claimed",
                  job: claimedJob,
                  runId,
                }),
              get: () => Effect.succeed(claimedJob),
              markEnqueueFailed: () => Effect.die("unexpected enqueue mark"),
              recoverRunnable: () => Effect.die("unexpected recovery"),
              retryFailedCreation: () => Effect.die("unexpected retry"),
              heartbeatRunning: () => Effect.void,
              markSucceeded: () =>
                Effect.fail(
                  new DispatchJobTerminalUpdateRejectedError({
                    dispatchRequestId: job.dispatchRequestId,
                    runId,
                    terminalStatus: "succeeded",
                    currentRunId,
                    currentStatus: "running",
                  }),
                ),
              markFailed: () => Effect.die("unexpected failed mark"),
            }),
            Layer.succeed(IngressBotClient)({} as never),
          ),
        ),
      );

      expect(result).toEqual({ ok: true });
    }),
  );

  it.effect("notifies stale failed runners when the replacement run fails", () =>
    Effect.gen(function* () {
      const notifiedFailure = yield* Deferred.make<{ token: string; content: unknown }>();

      const result = yield* runTracked({
        dispatchRequestId: job.dispatchRequestId,
        interactionToken: "interaction-token",
        successSchema: DispatchEntityResult,
        effect: Effect.fail("boom"),
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            Layer.succeed(DispatchJobs)({
              acceptCreation: () => Effect.die("unexpected accept"),
              acceptButton: () => Effect.die("unexpected accept"),
              claimRunning: () =>
                Effect.succeed({
                  _tag: "claimed",
                  job: claimedJob,
                  runId,
                }),
              get: () => Effect.succeed({ ...claimedJob, status: "failed" }),
              markEnqueueFailed: () => Effect.die("unexpected enqueue mark"),
              recoverRunnable: () => Effect.die("unexpected recovery"),
              retryFailedCreation: () => Effect.die("unexpected retry"),
              heartbeatRunning: () => Effect.void,
              markSucceeded: () => Effect.die("unexpected success mark"),
              markFailed: () =>
                Effect.fail(
                  new DispatchJobTerminalUpdateRejectedError({
                    dispatchRequestId: job.dispatchRequestId,
                    runId,
                    terminalStatus: "failed",
                    currentRunId,
                    currentStatus: "running",
                  }),
                ),
            }),
            Layer.succeed(IngressBotClient)({
              updateOriginalInteractionResponse: (token: string, payload: { content?: unknown }) =>
                Deferred.succeed(notifiedFailure, { token, content: payload.content }).pipe(
                  Effect.as({}),
                ),
            } as never),
          ),
        ),
      );

      expect(result).toBeUndefined();
      expect(yield* Deferred.await(notifiedFailure)).toEqual({
        token: "interaction-token",
        content: "Dispatch failed. Please try again.",
      });
    }),
  );

  it.effect("does not notify stale failed runners after a replacement succeeds", () =>
    Effect.gen(function* () {
      let notifiedFailure = false;

      const result = yield* runTracked({
        dispatchRequestId: job.dispatchRequestId,
        interactionToken: "interaction-token",
        successSchema: DispatchEntityResult,
        effect: Effect.fail("boom"),
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            Layer.succeed(DispatchJobs)({
              acceptCreation: () => Effect.die("unexpected accept"),
              acceptButton: () => Effect.die("unexpected accept"),
              claimRunning: () =>
                Effect.succeed({
                  _tag: "claimed",
                  job: claimedJob,
                  runId,
                }),
              get: () => Effect.succeed({ ...claimedJob, status: "succeeded" }),
              markEnqueueFailed: () => Effect.die("unexpected enqueue mark"),
              recoverRunnable: () => Effect.die("unexpected recovery"),
              retryFailedCreation: () => Effect.die("unexpected retry"),
              heartbeatRunning: () => Effect.void,
              markSucceeded: () => Effect.die("unexpected success mark"),
              markFailed: () =>
                Effect.fail(
                  new DispatchJobTerminalUpdateRejectedError({
                    dispatchRequestId: job.dispatchRequestId,
                    runId,
                    terminalStatus: "failed",
                    currentRunId,
                    currentStatus: "succeeded",
                  }),
                ),
            }),
            Layer.succeed(IngressBotClient)({
              updateOriginalInteractionResponse: () =>
                Effect.sync(() => {
                  notifiedFailure = true;
                  return {};
                }),
            } as never),
          ),
        ),
      );

      expect(result).toBeUndefined();
      yield* Effect.yieldNow;
      expect(notifiedFailure).toBe(false);
    }),
  );
});
