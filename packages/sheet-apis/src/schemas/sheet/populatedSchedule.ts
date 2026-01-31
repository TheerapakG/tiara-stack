import { Array, HashMap, Number, Option, pipe, Schema } from "effect";
import { Player, PartialNamePlayer } from "./player";
import { Monitor, PartialNameMonitor } from "./monitor";
import { RawSchedulePlayer } from "./rawSchedulePlayer";
import { Schedule } from "./schedule";

// Player wrapper with resolved player and enc flag
export class PopulatedSchedulePlayer extends Schema.TaggedClass<PopulatedSchedulePlayer>()(
  "PopulatedSchedulePlayer",
  {
    player: Schema.Union(Player, PartialNamePlayer),
    enc: Schema.Boolean,
  },
) {}

// Monitor wrapper with resolved monitor
export class PopulatedScheduleMonitor extends Schema.TaggedClass<PopulatedScheduleMonitor>()(
  "PopulatedScheduleMonitor",
  {
    monitor: Schema.Union(Monitor, PartialNameMonitor),
  },
) {}

// Full populated schedule with all players and monitor resolved
export class PopulatedSchedule extends Schema.TaggedClass<PopulatedSchedule>()(
  "PopulatedSchedule",
  {
    channel: Schema.String,
    day: Schema.Number,
    visible: Schema.Boolean,
    hour: Schema.OptionFromNullishOr(Schema.Number, undefined),
    fills: pipe(
      Schema.Array(Schema.OptionFromNullishOr(PopulatedSchedulePlayer, undefined)),
      Schema.itemsCount(5),
    ),
    overfills: Schema.Array(PopulatedSchedulePlayer),
    standbys: Schema.Array(PopulatedSchedulePlayer),
    runners: Schema.Array(PopulatedSchedulePlayer),
    monitor: Schema.OptionFromNullishOr(PopulatedScheduleMonitor, undefined),
  },
) {
  static empty = ({ fills, overfills }: PopulatedSchedule): number =>
    Number.max(5 - fills.filter(Option.isSome).length - overfills.length, 0);
}

// Break schedule (passes through unchanged - no players/monitors)
export class PopulatedBreakSchedule extends Schema.TaggedClass<PopulatedBreakSchedule>()(
  "PopulatedBreakSchedule",
  {
    channel: Schema.String,
    day: Schema.Number,
    visible: Schema.Boolean,
    hour: Schema.OptionFromNullishOr(Schema.Number, undefined),
  },
) {}

// Union type for all populated schedule results
export type PopulatedScheduleResult = PopulatedBreakSchedule | PopulatedSchedule;
export const PopulatedScheduleResult = Schema.Union(PopulatedBreakSchedule, PopulatedSchedule);

// Helper type for player resolution map
type PlayerResolutionMap = HashMap.HashMap<string, Array.NonEmptyArray<Player | PartialNamePlayer>>;

// Helper type for monitor resolution map
type MonitorResolutionMap = HashMap.HashMap<
  string,
  Array.NonEmptyArray<Monitor | PartialNameMonitor>
>;

// Helper function to get player from map
const getPlayerFromMap = (
  map: PlayerResolutionMap,
  name: string,
): Array.NonEmptyArray<Player | PartialNamePlayer> => {
  const result = HashMap.get(map, name);
  if (Option.isSome(result)) {
    return result.value;
  }
  return Array.make(PartialNamePlayer.make({ name }));
};

// Helper function to get monitor from map
const getMonitorFromMap = (
  map: MonitorResolutionMap,
  name: string,
): Array.NonEmptyArray<Monitor | PartialNameMonitor> => {
  const result = HashMap.get(map, name);
  if (Option.isSome(result)) {
    return result.value;
  }
  return Array.make(PartialNameMonitor.make({ name }));
};

// Creates a PopulatedSchedulePlayer from raw player data and resolved player
const makePopulatedSchedulePlayer = (
  rawPlayer: RawSchedulePlayer,
  resolvedPlayers: Array.NonEmptyArray<Player | PartialNamePlayer>,
): PopulatedSchedulePlayer =>
  PopulatedSchedulePlayer.make({
    player: Array.headNonEmpty(resolvedPlayers),
    enc: rawPlayer.enc,
  });

// Creates a PopulatedScheduleMonitor from monitor name and resolved monitor
const makePopulatedScheduleMonitor = (
  monitorName: string,
  resolvedMonitors: Array.NonEmptyArray<Monitor | PartialNameMonitor>,
): PopulatedScheduleMonitor =>
  PopulatedScheduleMonitor.make({
    monitor: Array.headNonEmpty(resolvedMonitors),
  });

// Converts a raw Schedule to a PopulatedSchedule
export const toPopulatedSchedule = (
  schedule: Schedule,
  playerMap: PlayerResolutionMap,
  monitorMap: MonitorResolutionMap,
): PopulatedSchedule => {
  // Resolve fills players
  const fills = Array.makeBy(5, (i) =>
    pipe(
      schedule.fills,
      Array.get(i),
      Option.flatten,
      Option.map((rawPlayer) =>
        makePopulatedSchedulePlayer(rawPlayer, getPlayerFromMap(playerMap, rawPlayer.player)),
      ),
    ),
  );

  // Resolve overfills players
  const overfills = pipe(
    schedule.overfills,
    Array.map((rawPlayer) =>
      makePopulatedSchedulePlayer(rawPlayer, getPlayerFromMap(playerMap, rawPlayer.player)),
    ),
  );

  // Resolve standbys players
  const standbys = pipe(
    schedule.standbys,
    Array.map((rawPlayer) =>
      makePopulatedSchedulePlayer(rawPlayer, getPlayerFromMap(playerMap, rawPlayer.player)),
    ),
  );

  // Resolve runners players
  const runners = pipe(
    schedule.runners,
    Array.map((rawPlayer) =>
      makePopulatedSchedulePlayer(rawPlayer, getPlayerFromMap(playerMap, rawPlayer.player)),
    ),
  );

  // Resolve monitor
  const monitor = pipe(
    schedule.monitor,
    Option.map((monitorName) =>
      makePopulatedScheduleMonitor(monitorName, getMonitorFromMap(monitorMap, monitorName)),
    ),
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
