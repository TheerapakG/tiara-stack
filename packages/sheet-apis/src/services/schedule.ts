import { Array, Effect, HashMap, Match, Option, pipe } from "effect";
import { SheetService } from "./sheet";
import { PlayerService } from "./player";
import { MonitorService } from "./monitor";
import { SheetConfigService } from "./sheetConfig";
import { withScheduleHourWindow } from "./hourWindow";
import {
  BreakSchedule,
  Schedule,
  PopulatedBreakSchedule,
  PopulatedSchedulePlayer,
  PopulatedScheduleMonitor,
  PopulatedSchedule,
  type PopulatedScheduleResult,
  Player,
  type PlayerDayScheduleSummary,
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
    hourWindow: schedule.hourWindow,
    fills,
    overfills,
    standbys,
    runners,
    monitor,
  });
};

// Helper function to build player and monitor maps
const buildResolutionMaps = (
  playerMaps: {
    nameToPlayer: HashMap.HashMap<string, { name: string; players: Array.NonEmptyArray<Player> }>;
  },
  monitorMaps: {
    nameToMonitor: HashMap.HashMap<string, { name: string; monitors: ReadonlyArray<Monitor> }>;
  },
) => {
  const playerMap = new Map<string, Array.NonEmptyArray<Player | PartialNamePlayer>>();

  const playerEntries = HashMap.toEntries(playerMaps.nameToPlayer);
  for (const entry of playerEntries) {
    const name: string = Tuple.getFirst(entry);
    const entryValue: { readonly name: string; readonly players: Array.NonEmptyArray<Player> } =
      Tuple.getSecond(entry);
    const players: Array.NonEmptyArray<Player> = entryValue.players;
    playerMap.set(name, players as Array.NonEmptyArray<Player | PartialNamePlayer>);
  }

  const monitorMap = new Map<string, Array.NonEmptyArray<Monitor | PartialNameMonitor>>();

  const monitorEntries = HashMap.toEntries(monitorMaps.nameToMonitor);
  for (const entry of monitorEntries) {
    const name: string = Tuple.getFirst(entry);
    const entryValue: { readonly name: string; readonly monitors: ReadonlyArray<Monitor> } =
      Tuple.getSecond(entry);
    const monitors: ReadonlyArray<Monitor> = entryValue.monitors;
    if (monitors.length > 0) {
      monitorMap.set(name, monitors as Array.NonEmptyArray<Monitor | PartialNameMonitor>);
    }
  }

  return { playerMap, monitorMap };
};

const populateScheduleResult = (
  schedule: BreakSchedule | Schedule,
  playerMap: Map<string, Array.NonEmptyArray<Player | PartialNamePlayer>>,
  monitorMap: Map<string, Array.NonEmptyArray<Monitor | PartialNameMonitor>>,
): PopulatedScheduleResult =>
  Match.value(schedule).pipe(
    Match.tagsExhaustive({
      BreakSchedule: (breakSchedule) =>
        PopulatedBreakSchedule.make({
          channel: breakSchedule.channel,
          day: breakSchedule.day,
          visible: breakSchedule.visible,
          hour: breakSchedule.hour,
          hourWindow: breakSchedule.hourWindow,
        }),
      Schedule: (currentSchedule) => populateSchedule(currentSchedule, playerMap, monitorMap),
    }),
  );

const toPopulatedSchedules = (
  schedules: ReadonlyArray<BreakSchedule | Schedule>,
  startTime: Effect.Effect.Success<ReturnType<SheetConfigService["getEventConfig"]>>["startTime"],
  playerMaps: {
    nameToPlayer: HashMap.HashMap<string, { name: string; players: Array.NonEmptyArray<Player> }>;
  },
  monitorMaps: {
    nameToMonitor: HashMap.HashMap<string, { name: string; monitors: ReadonlyArray<Monitor> }>;
  },
): ReadonlyArray<PopulatedScheduleResult> => {
  const { playerMap, monitorMap } = buildResolutionMaps(playerMaps, monitorMaps);

  return pipe(
    schedules,
    Array.map((schedule) => withScheduleHourWindow(startTime, schedule)),
    Array.map((schedule) => populateScheduleResult(schedule, playerMap, monitorMap)),
  );
};

const schedulePlayerMatchesUser = (
  schedulePlayer: PopulatedSchedulePlayer,
  accountId: string,
): boolean =>
  Match.value(schedulePlayer.player).pipe(
    Match.tagsExhaustive({
      Player: (player) => player.id === accountId,
      PartialNamePlayer: () => false,
    }),
  );

const sortHours = (hours: ReadonlyArray<number>): number[] =>
  [...hours]
    .sort((a, b) => a - b)
    .filter((hour, index, sorted) => index === 0 || hour !== sorted[index - 1]);

export const summarizeDayPlayerSchedule = (
  schedules: ReadonlyArray<PopulatedScheduleResult>,
  accountId: string,
): PlayerDayScheduleSummary => {
  // Filler schedule inputs are already visibility-filtered by
  // `get*PopulatedFillerSchedules`, so a hidden populated schedule here only
  // appears on monitor-view paths and should mark the day as invisible.
  let invisible = false;
  const fillHours: number[] = [];
  const overfillHours: number[] = [];
  const standbyHours: number[] = [];

  for (const schedule of schedules) {
    if (schedule._tag === "PopulatedSchedule" && !schedule.visible) {
      invisible = true;
    }

    if (schedule._tag !== "PopulatedSchedule" || Option.isNone(schedule.hour)) {
      continue;
    }

    const hour = schedule.hour.value;

    if (
      schedule.fills.some(
        (fill) => Option.isSome(fill) && schedulePlayerMatchesUser(fill.value, accountId),
      )
    ) {
      fillHours.push(hour);
    }

    if (schedule.overfills.some((overfill) => schedulePlayerMatchesUser(overfill, accountId))) {
      overfillHours.push(hour);
    }

    if (schedule.standbys.some((standby) => schedulePlayerMatchesUser(standby, accountId))) {
      standbyHours.push(hour);
    }
  }

  return {
    fillHours: sortHours(fillHours),
    overfillHours: sortHours(overfillHours),
    standbyHours: sortHours(standbyHours),
    invisible,
  };
};

export class ScheduleService extends Effect.Service<ScheduleService>()("ScheduleService", {
  effect: pipe(
    Effect.Do,
    Effect.bind("sheetService", () => SheetService),
    Effect.bind("playerService", () => PlayerService),
    Effect.bind("monitorService", () => MonitorService),
    Effect.bind("sheetConfigService", () => SheetConfigService),
    Effect.map(({ sheetService, playerService, monitorService, sheetConfigService }) => {
      return {
        getAllPopulatedSchedules: (sheetId: string) =>
          pipe(
            Effect.Do,
            Effect.bind("schedules", () => sheetService.getAllSchedules(sheetId)),
            Effect.bind("playerMaps", () => playerService.getPlayerMaps(sheetId)),
            Effect.bind("monitorMaps", () => monitorService.getMonitorMaps(sheetId)),
            Effect.bind("eventConfig", () => sheetConfigService.getEventConfig(sheetId)),
            Effect.map(({ schedules, playerMaps, monitorMaps, eventConfig }) => {
              return toPopulatedSchedules(
                schedules,
                eventConfig.startTime,
                playerMaps,
                monitorMaps,
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
            Effect.bind("playerMaps", () => playerService.getPlayerMaps(sheetId)),
            Effect.bind("monitorMaps", () => monitorService.getMonitorMaps(sheetId)),
            Effect.bind("eventConfig", () => sheetConfigService.getEventConfig(sheetId)),
            Effect.map(({ schedules, playerMaps, monitorMaps, eventConfig }) => {
              return toPopulatedSchedules(
                schedules,
                eventConfig.startTime,
                playerMaps,
                monitorMaps,
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
            Effect.bind("playerMaps", () => playerService.getPlayerMaps(sheetId)),
            Effect.bind("monitorMaps", () => monitorService.getMonitorMaps(sheetId)),
            Effect.bind("eventConfig", () => sheetConfigService.getEventConfig(sheetId)),
            Effect.map(({ schedules, playerMaps, monitorMaps, eventConfig }) => {
              return toPopulatedSchedules(
                schedules,
                eventConfig.startTime,
                playerMaps,
                monitorMaps,
              );
            }),
            Effect.withSpan("ScheduleService.getChannelPopulatedSchedules", {
              captureStackTrace: true,
            }),
          ),
        // Filler populated schedules - filtered by visible, with fill/overfill/standby/runners cleared
        getAllPopulatedFillerSchedules: (sheetId: string) =>
          pipe(
            Effect.Do,
            Effect.bind("schedules", () => sheetService.getAllFillerSchedules(sheetId)),
            Effect.bind("playerMaps", () => playerService.getPlayerMaps(sheetId)),
            Effect.bind("monitorMaps", () => monitorService.getMonitorMaps(sheetId)),
            Effect.bind("eventConfig", () => sheetConfigService.getEventConfig(sheetId)),
            Effect.map(({ schedules, playerMaps, monitorMaps, eventConfig }) => {
              return toPopulatedSchedules(
                schedules,
                eventConfig.startTime,
                playerMaps,
                monitorMaps,
              );
            }),
            Effect.withSpan("ScheduleService.getAllPopulatedFillerSchedules", {
              captureStackTrace: true,
            }),
          ),
        getDayPopulatedFillerSchedules: (sheetId: string, day: number) =>
          pipe(
            Effect.Do,
            Effect.bind("schedules", () => sheetService.getDayFillerSchedules(sheetId, day)),
            Effect.bind("playerMaps", () => playerService.getPlayerMaps(sheetId)),
            Effect.bind("monitorMaps", () => monitorService.getMonitorMaps(sheetId)),
            Effect.bind("eventConfig", () => sheetConfigService.getEventConfig(sheetId)),
            Effect.map(({ schedules, playerMaps, monitorMaps, eventConfig }) => {
              return toPopulatedSchedules(
                schedules,
                eventConfig.startTime,
                playerMaps,
                monitorMaps,
              );
            }),
            Effect.withSpan("ScheduleService.getDayPopulatedFillerSchedules", {
              captureStackTrace: true,
            }),
          ),
        getChannelPopulatedFillerSchedules: (sheetId: string, channel: string) =>
          pipe(
            Effect.Do,
            Effect.bind("schedules", () =>
              sheetService.getChannelFillerSchedules(sheetId, channel),
            ),
            Effect.bind("playerMaps", () => playerService.getPlayerMaps(sheetId)),
            Effect.bind("monitorMaps", () => monitorService.getMonitorMaps(sheetId)),
            Effect.bind("eventConfig", () => sheetConfigService.getEventConfig(sheetId)),
            Effect.map(({ schedules, playerMaps, monitorMaps, eventConfig }) => {
              return toPopulatedSchedules(
                schedules,
                eventConfig.startTime,
                playerMaps,
                monitorMaps,
              );
            }),
            Effect.withSpan("ScheduleService.getChannelPopulatedFillerSchedules", {
              captureStackTrace: true,
            }),
          ),
      };
    }),
  ),
  accessors: true,
  dependencies: [
    SheetService.Default,
    PlayerService.Default,
    MonitorService.Default,
    SheetConfigService.Default,
  ],
}) {}
