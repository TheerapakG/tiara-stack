import { Array, Effect, HashMap, Match, Option, pipe } from "effect";
import { SheetService } from "./sheet";
import { PlayerService } from "./player";
import { MonitorService } from "./monitor";
import {
  Schedule,
  PopulatedBreakSchedule,
  PopulatedSchedulePlayer,
  PopulatedScheduleMonitor,
  PopulatedSchedule,
  Player,
  PartialNamePlayer,
  Monitor,
  PartialNameMonitor,
} from "@/schemas/sheet";
import { upperFirst } from "scule";
import { Tuple } from "effect";

const populateSchedule = (
  schedule: Schedule,
  playerMap: Map<string, Array.NonEmptyArray<Player | PartialNamePlayer>>,
  monitorMap: Map<string, Array.NonEmptyArray<Monitor | PartialNameMonitor>>,
): PopulatedSchedule => {
  // Resolve fills players
  const fills = Array.makeBy(5, (i) =>
    pipe(
      schedule.fills,
      Array.get(i),
      Option.flatten,
      Option.map((rawPlayer) => {
        const players =
          playerMap.get(upperFirst(rawPlayer.player)) ||
          Array.make(new PartialNamePlayer({ name: upperFirst(rawPlayer.player) }));
        return PopulatedSchedulePlayer.make({
          player: Array.headNonEmpty(players),
          enc: rawPlayer.enc,
        });
      }),
    ),
  );

  // Resolve overfills players
  const overfills = schedule.overfills.map((rawPlayer) => {
    const players =
      playerMap.get(upperFirst(rawPlayer.player)) ||
      Array.make(new PartialNamePlayer({ name: upperFirst(rawPlayer.player) }));
    return PopulatedSchedulePlayer.make({
      player: Array.headNonEmpty(players),
      enc: rawPlayer.enc,
    });
  });

  // Resolve standbys players
  const standbys = schedule.standbys.map((rawPlayer) => {
    const players =
      playerMap.get(upperFirst(rawPlayer.player)) ||
      Array.make(new PartialNamePlayer({ name: upperFirst(rawPlayer.player) }));
    return PopulatedSchedulePlayer.make({
      player: Array.headNonEmpty(players),
      enc: rawPlayer.enc,
    });
  });

  // Resolve runners players
  const runners = schedule.runners.map((rawPlayer) => {
    const players =
      playerMap.get(upperFirst(rawPlayer.player)) ||
      Array.make(new PartialNamePlayer({ name: upperFirst(rawPlayer.player) }));
    return PopulatedSchedulePlayer.make({
      player: Array.headNonEmpty(players),
      enc: rawPlayer.enc,
    });
  });

  // Resolve monitor
  const monitor = pipe(
    schedule.monitor,
    Option.map((name) => {
      const monitors =
        monitorMap.get(upperFirst(name)) ||
        Array.make(new PartialNameMonitor({ name: upperFirst(name) }));
      return PopulatedScheduleMonitor.make({
        monitor: Array.headNonEmpty(monitors),
      });
    }),
  );

  return PopulatedSchedule.make({
    channel: schedule.channel,
    day: schedule.day,
    visible: schedule.visible,
    hour: schedule.hour,
    fills,
    overfills,
    standbys,
    runners,
    monitor,
  });
};

export class ScheduleService extends Effect.Service<ScheduleService>()("ScheduleService", {
  effect: pipe(
    Effect.Do,
    Effect.bind("sheetService", () => SheetService),
    Effect.bind("playerService", () => PlayerService),
    Effect.bind("monitorService", () => MonitorService),
    Effect.map(({ sheetService, playerService, monitorService }) => {
      return {
        getAllPopulatedSchedules: (sheetId: string) =>
          pipe(
            Effect.Do,
            Effect.bind("schedules", () => sheetService.getAllSchedules(sheetId)),
            Effect.bind("playerMaps", () => playerService.getPlayerMaps()),
            Effect.bind("monitorMaps", () => monitorService.getMonitorMaps()),
            Effect.map(({ schedules, playerMaps, monitorMaps }) => {
              const playerMap = new Map<string, Array.NonEmptyArray<Player | PartialNamePlayer>>();

              // Build player map from nameToPlayer entries
              // Note: filterMap already unwraps the Option, so players is guaranteed to exist
              const playerEntries = HashMap.toEntries(playerMaps.nameToPlayer);
              for (const entry of playerEntries) {
                const name: string = Tuple.getFirst(entry);
                const entryValue: { name: string; players: Array.NonEmptyArray<Player> } =
                  Tuple.getSecond(entry);
                const players: Array.NonEmptyArray<Player> = entryValue.players;
                playerMap.set(name, players as Array.NonEmptyArray<Player | PartialNamePlayer>);
              }

              const monitorMap = new Map<
                string,
                Array.NonEmptyArray<Monitor | PartialNameMonitor>
              >();

              // Build monitor map from nameToMonitor entries
              const monitorEntries = HashMap.toEntries(monitorMaps.nameToMonitor);
              for (const entry of monitorEntries) {
                const name: string = Tuple.getFirst(entry);
                const entryValue: { name: string; monitors: ReadonlyArray<Monitor> } =
                  Tuple.getSecond(entry);
                const monitors: ReadonlyArray<Monitor> = entryValue.monitors;
                if (monitors.length > 0) {
                  monitorMap.set(
                    name,
                    monitors as Array.NonEmptyArray<Monitor | PartialNameMonitor>,
                  );
                }
              }

              return pipe(
                schedules,
                Array.map((schedule) =>
                  Match.value(schedule).pipe(
                    Match.tagsExhaustive({
                      BreakSchedule: (breakSchedule) =>
                        PopulatedBreakSchedule.make({
                          channel: breakSchedule.channel,
                          day: breakSchedule.day,
                          visible: breakSchedule.visible,
                          hour: breakSchedule.hour,
                        }),
                      Schedule: (s) => populateSchedule(s, playerMap, monitorMap),
                    }),
                  ),
                ),
              );
            }),
            Effect.withSpan("ScheduleService.getAllPopulatedSchedules", {
              captureStackTrace: true,
            }),
          ),
        getDayPopulatedSchedules: (sheetId: string, day: number) =>
          pipe(
            Effect.Do,
            Effect.bind("schedules", () => sheetService.getDaySchedules(sheetId, day)),
            Effect.bind("playerMaps", () => playerService.getPlayerMaps()),
            Effect.bind("monitorMaps", () => monitorService.getMonitorMaps()),
            Effect.map(({ schedules, playerMaps, monitorMaps }) => {
              const playerMap = new Map<string, Array.NonEmptyArray<Player | PartialNamePlayer>>();

              const playerEntries = HashMap.toEntries(playerMaps.nameToPlayer);
              for (const entry of playerEntries) {
                const name: string = Tuple.getFirst(entry);
                const entryValue: { name: string; players: Array.NonEmptyArray<Player> } =
                  Tuple.getSecond(entry);
                const players: Array.NonEmptyArray<Player> = entryValue.players;
                playerMap.set(name, players as Array.NonEmptyArray<Player | PartialNamePlayer>);
              }

              const monitorMap = new Map<
                string,
                Array.NonEmptyArray<Monitor | PartialNameMonitor>
              >();

              const monitorEntries = HashMap.toEntries(monitorMaps.nameToMonitor);
              for (const entry of monitorEntries) {
                const name: string = Tuple.getFirst(entry);
                const entryValue: { name: string; monitors: ReadonlyArray<Monitor> } =
                  Tuple.getSecond(entry);
                const monitors: ReadonlyArray<Monitor> = entryValue.monitors;
                if (monitors.length > 0) {
                  monitorMap.set(
                    name,
                    monitors as Array.NonEmptyArray<Monitor | PartialNameMonitor>,
                  );
                }
              }

              return pipe(
                schedules,
                Array.map((schedule) =>
                  Match.value(schedule).pipe(
                    Match.tagsExhaustive({
                      BreakSchedule: (breakSchedule) =>
                        PopulatedBreakSchedule.make({
                          channel: breakSchedule.channel,
                          day: breakSchedule.day,
                          visible: breakSchedule.visible,
                          hour: breakSchedule.hour,
                        }),
                      Schedule: (s) => populateSchedule(s, playerMap, monitorMap),
                    }),
                  ),
                ),
              );
            }),
            Effect.withSpan("ScheduleService.getDayPopulatedSchedules", {
              captureStackTrace: true,
            }),
          ),
        getChannelPopulatedSchedules: (sheetId: string, channel: string) =>
          pipe(
            Effect.Do,
            Effect.bind("schedules", () => sheetService.getChannelSchedules(sheetId, channel)),
            Effect.bind("playerMaps", () => playerService.getPlayerMaps()),
            Effect.bind("monitorMaps", () => monitorService.getMonitorMaps()),
            Effect.map(({ schedules, playerMaps, monitorMaps }) => {
              const playerMap = new Map<string, Array.NonEmptyArray<Player | PartialNamePlayer>>();

              const playerEntries = HashMap.toEntries(playerMaps.nameToPlayer);
              for (const entry of playerEntries) {
                const name: string = Tuple.getFirst(entry);
                const entryValue: { name: string; players: Array.NonEmptyArray<Player> } =
                  Tuple.getSecond(entry);
                const players: Array.NonEmptyArray<Player> = entryValue.players;
                playerMap.set(name, players as Array.NonEmptyArray<Player | PartialNamePlayer>);
              }

              const monitorMap = new Map<
                string,
                Array.NonEmptyArray<Monitor | PartialNameMonitor>
              >();

              const monitorEntries = HashMap.toEntries(monitorMaps.nameToMonitor);
              for (const entry of monitorEntries) {
                const name: string = Tuple.getFirst(entry);
                const entryValue: { name: string; monitors: ReadonlyArray<Monitor> } =
                  Tuple.getSecond(entry);
                const monitors: ReadonlyArray<Monitor> = entryValue.monitors;
                if (monitors.length > 0) {
                  monitorMap.set(
                    name,
                    monitors as Array.NonEmptyArray<Monitor | PartialNameMonitor>,
                  );
                }
              }

              return pipe(
                schedules,
                Array.map((schedule) =>
                  Match.value(schedule).pipe(
                    Match.tagsExhaustive({
                      BreakSchedule: (breakSchedule) =>
                        PopulatedBreakSchedule.make({
                          channel: breakSchedule.channel,
                          day: breakSchedule.day,
                          visible: breakSchedule.visible,
                          hour: breakSchedule.hour,
                        }),
                      Schedule: (s) => populateSchedule(s, playerMap, monitorMap),
                    }),
                  ),
                ),
              );
            }),
            Effect.withSpan("ScheduleService.getChannelPopulatedSchedules", {
              captureStackTrace: true,
            }),
          ),
      };
    }),
  ),
  accessors: true,
  dependencies: [SheetService.Default, PlayerService.Default, MonitorService.Default],
}) {}
