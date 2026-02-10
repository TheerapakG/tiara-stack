import { bold, time, TimestampStyles, userMention } from "@discordjs/formatters";
import Handlebars from "handlebars";
import {
  Array,
  Data,
  DateTime,
  Effect,
  HashSet,
  Match,
  Number,
  Option,
  Order,
  pipe,
  Random,
  String,
} from "effect";
import { ConverterService, HourWindow } from "./converter";
import { Sheet } from "sheet-apis/schema";

type Weighted<A> = { value: A; weight: number };

const pickWeighted = <A>(items: Array.NonEmptyReadonlyArray<Weighted<A>>) =>
  pipe(
    Effect.Do,
    Effect.bind("accumItems", () =>
      pipe(
        items,
        Array.scan({ value: Option.none<A>(), weight: 0 }, (s, { value, weight }) => ({
          value: Option.some(value),
          weight: s.weight + weight,
        })),
        Array.filterMap(({ value, weight }) =>
          pipe(
            value,
            Option.map((value) => ({ value, weight })),
          ),
        ),
        Array.match({
          onEmpty: () => Effect.die("pickWeighted: impossible"),
          onNonEmpty: (items) => Effect.succeed(items),
        }),
      ),
    ),
    Effect.bind("random", ({ accumItems }) =>
      Random.nextRange(
        0,
        pipe(accumItems, Array.lastNonEmpty, ({ weight }) => weight),
      ),
    ),
    Effect.flatMap(({ accumItems, random }) =>
      pipe(
        accumItems,
        Array.findFirst(({ weight }) => random < weight),
        Option.match({
          onSome: ({ value }) => Effect.succeed(value),
          onNone: () => Effect.die("pickWeighted: impossible"),
        }),
      ),
    ),
  );

const checkinMessageTemplates: Array.NonEmptyReadonlyArray<Weighted<string>> = [
  {
    value:
      "{{mentionsString}} Press the button below to check in, and {{channelString}} {{hourString}} {{timeStampString}}",
    weight: 0.5,
  },
  {
    value:
      "{{mentionsString}} The goddess Miku is calling for you to fill. Press the button below to check in, and {{channelString}} {{hourString}} {{timeStampString}}",
    weight: 0.25,
  },
  {
    value:
      "{{mentionsString}} Press the button below to check in, and {{channelString}} {{hourString}} {{timeStampString}}. ... Beep Boop. Beep Boop. zzzt... zzzt... zzzt...",
    weight: 0.05,
  },
  {
    value:
      "{{mentionsString}} Press the button below to check in, and {{channelString}} {{hourString}} {{timeStampString}}\n~~or VBS Miku will recruit you for some taste testing of her cooking.~~",
    weight: 0.05,
  },
  {
    value:
      "{{mentionsString}} Ebi jail AAAAAAAAAAAAAAAAAAAAAAA. Press the button below to check in, and {{channelString}} {{hourString}} {{timeStampString}}",
    weight: 0.05,
  },
  {
    value:
      "{{mentionsString}} Miku's voice echoes in the empty SEKAI. Press the button below to check in, then {{channelString}} {{hourString}} {{timeStampString}}",
    weight: 0.05,
  },
  {
    value:
      "{{mentionsString}} The clock hits 25:00. Miku whispers from the empty SEKAI. Press the button below to check in, then {{channelString}} {{hourString}} {{timeStampString}}",
    weight: 0.05,
  },
];

export class FormattedHourWindow extends Data.TaggedClass("FormattedHourWindow")<{
  start: number;
  end: number;
}> {}

export class FormatService extends Effect.Service<FormatService>()("FormatService", {
  effect: pipe(
    Effect.Do,
    Effect.bind("converterService", () => ConverterService),
    Effect.let(
      "formatDateTime",
      () => (dateTime: DateTime.DateTime) =>
        pipe(dateTime, DateTime.toEpochMillis, Number.unsafeDivide(1000)),
    ),
    Effect.let("formatHourWindow", ({ formatDateTime }) =>
      Effect.fn("FormatService.formatHourWindow")((hourWindow: HourWindow) =>
        Effect.succeed(
          new FormattedHourWindow({
            start: formatDateTime(hourWindow.start),
            end: formatDateTime(hourWindow.end),
          }),
        ),
      ),
    ),
    Effect.map(({ converterService, formatDateTime, formatHourWindow }) => ({
      formatDateTime,
      formatHourWindow,
      formatOpenSlot: Effect.fn("FormatService.formatOpenSlot")(
        (guildId: string, schedule: Sheet.PopulatedBreakSchedule | Sheet.PopulatedSchedule) =>
          pipe(
            Match.value(schedule),
            Match.tagsExhaustive({
              PopulatedBreakSchedule: () => Effect.succeed(""),
              PopulatedSchedule: (schedule) =>
                pipe(
                  Effect.succeed({
                    hour: schedule.hour,
                    empty: Sheet.PopulatedSchedule.empty(schedule),
                  }),
                  Effect.let("slotCountString", ({ empty }) =>
                    schedule.visible ? bold(`+${empty} |`) : "",
                  ),
                  Effect.let("hourString", ({ hour }) =>
                    pipe(
                      hour,
                      Option.map((hour) => bold(`hour ${hour}`)),
                      Option.getOrElse(() => bold("hour ??")),
                    ),
                  ),
                  Effect.bind("rangeString", ({ hour }) =>
                    pipe(
                      hour,
                      Option.map((h) =>
                        pipe(
                          converterService.convertHourToHourWindow(guildId, h),
                          Effect.flatMap(formatHourWindow),
                          Effect.map(
                            (hw) =>
                              `${time(hw.start, TimestampStyles.ShortTime)}-${time(hw.end, TimestampStyles.ShortTime)}`,
                          ),
                          Effect.catchAll(() => Effect.succeed("??-??")),
                        ),
                      ),
                      Option.getOrElse(() => Effect.succeed("??-??")),
                    ),
                  ),
                  Effect.map(({ empty, slotCountString, hourString, rangeString }) =>
                    !schedule.visible || Order.greaterThan(Number.Order)(empty, 0)
                      ? pipe(
                          [slotCountString, hourString, rangeString],
                          Array.filter(String.isNonEmpty),
                          Array.join(" "),
                        )
                      : "",
                  ),
                ),
            }),
          ),
      ),
      formatFilledSlot: Effect.fn("FormatService.formatFilledSlot")(
        (guildId: string, schedule: Sheet.PopulatedBreakSchedule | Sheet.PopulatedSchedule) =>
          pipe(
            Match.value(schedule),
            Match.tagsExhaustive({
              PopulatedBreakSchedule: () => Effect.succeed(""),
              PopulatedSchedule: (schedule) =>
                pipe(
                  Effect.succeed({
                    hour: schedule.hour,
                    empty: Sheet.PopulatedSchedule.empty(schedule),
                  }),
                  Effect.let("hourString", ({ hour }) =>
                    pipe(
                      hour,
                      Option.map((hour) => bold(`hour ${hour}`)),
                      Option.getOrElse(() => bold("hour ??")),
                    ),
                  ),
                  Effect.bind("rangeString", ({ hour }) =>
                    pipe(
                      hour,
                      Option.map((h) =>
                        pipe(
                          converterService.convertHourToHourWindow(guildId, h),
                          Effect.flatMap(formatHourWindow),
                          Effect.map(
                            (hw) =>
                              `${time(hw.start, TimestampStyles.ShortTime)}-${time(hw.end, TimestampStyles.ShortTime)}`,
                          ),
                          Effect.catchAll(() => Effect.succeed("??-??")),
                        ),
                      ),
                      Option.getOrElse(() => Effect.succeed("??-??")),
                    ),
                  ),
                  Effect.map(({ empty, hourString, rangeString }) =>
                    schedule.visible && Number.Equivalence(empty, 0)
                      ? pipe(
                          [hourString, rangeString],
                          Array.filter(String.isNonEmpty),
                          Array.join(" "),
                        )
                      : "",
                  ),
                ),
            }),
          ),
      ),
      formatCheckIn: Effect.fn("FormatService.formatCheckIn")(
        (
          guildId: string,
          {
            prevSchedule,
            schedule,
            channelString,
            template,
          }: {
            prevSchedule: Option.Option<Sheet.PopulatedSchedule | Sheet.PopulatedBreakSchedule>;
            schedule: Option.Option<Sheet.PopulatedSchedule | Sheet.PopulatedBreakSchedule>;
            channelString: string;
            template?: string;
          },
        ) =>
          pipe(
            Effect.Do,
            Effect.let("hour", () =>
              pipe(
                schedule,
                Option.flatMap((schedule) => schedule.hour),
              ),
            ),
            Effect.let("prevFills", () =>
              pipe(
                prevSchedule,
                Option.map((prevSchedule) =>
                  pipe(
                    Match.value(prevSchedule),
                    Match.tagsExhaustive({
                      PopulatedBreakSchedule: () => [],
                      PopulatedSchedule: (prevSchedule) => prevSchedule.fills,
                    }),
                  ),
                ),
                Option.getOrElse(() => []),
                Array.getSomes,
                Array.map((player) =>
                  pipe(
                    Match.value(player.player),
                    Match.tagsExhaustive({
                      Player: (player) => userMention(player.id),
                      PartialNamePlayer: (player) => player.name,
                    }),
                  ),
                ),
              ),
            ),
            Effect.let("fills", () =>
              pipe(
                schedule,
                Option.map((schedule) =>
                  pipe(
                    Match.value(schedule),
                    Match.tagsExhaustive({
                      PopulatedBreakSchedule: () => [],
                      PopulatedSchedule: (schedule) => schedule.fills,
                    }),
                  ),
                ),
                Option.getOrElse(() => []),
                Array.getSomes,
                Array.map((player) =>
                  pipe(
                    Match.value(player.player),
                    Match.tagsExhaustive({
                      Player: (player) => userMention(player.id),
                      PartialNamePlayer: (player) => player.name,
                    }),
                  ),
                ),
              ),
            ),
            Effect.bind("timeStampString", ({ hour }) =>
              pipe(
                hour,
                Option.map((h) =>
                  pipe(
                    converterService.convertHourToHourWindow(guildId, h),
                    Effect.flatMap(formatHourWindow),
                    Effect.map((hw) => time(hw.start, TimestampStyles.RelativeTime)),
                    Effect.catchAll(() => Effect.succeed("")),
                  ),
                ),
                Option.getOrElse(() => Effect.succeed("")),
              ),
            ),
            Effect.let("mentionsString", ({ fills, prevFills }) =>
              pipe(
                HashSet.fromIterable(fills),
                HashSet.difference(HashSet.fromIterable(prevFills)),
                HashSet.toValues,
                Option.some,
                Option.filter(Array.isNonEmptyArray),
                Option.map(Array.join(" ")),
              ),
            ),
            Effect.let("hourString", ({ hour }) =>
              pipe(
                hour,
                Option.map((h) => `for ${bold(`hour ${h}`)}`),
                Option.getOrElse(() => ""),
              ),
            ),
            Effect.bind("template", () =>
              pipe(
                template,
                Option.fromNullable,
                Option.match({
                  onSome: () => Effect.succeed(template),
                  onNone: () => pickWeighted(checkinMessageTemplates),
                }),
              ),
            ),
            Effect.let(
              "checkinMessage",
              ({ mentionsString, hourString, timeStampString, template }) =>
                pipe(
                  mentionsString,
                  Option.map((mentionsString) => {
                    const render = Handlebars.compile(template, {
                      noEscape: true,
                    });
                    return render({
                      mentionsString,
                      channelString,
                      hourString,
                      timeStampString,
                    });
                  }),
                ),
            ),
            Effect.let("empty", () =>
              pipe(
                schedule,
                Option.map((schedule) =>
                  pipe(
                    Match.value(schedule),
                    Match.tagsExhaustive({
                      PopulatedBreakSchedule: () => 5,
                      PopulatedSchedule: (schedule) => Sheet.PopulatedSchedule.empty(schedule),
                    }),
                  ),
                ),
                Option.getOrElse(() => 5),
              ),
            ),
            Effect.let(
              "emptySlotMessage",
              ({ empty }) =>
                `${
                  Order.greaterThan(Number.Order)(empty, 0) ? `+${empty}` : "No"
                } empty slot${Order.greaterThan(Number.Order)(empty, 1) ? "s" : ""}`,
            ),
            Effect.let("playersMessage", ({ fills }) => `Players: ${pipe(fills, Array.join(" "))}`),
            Effect.let("lookupFailedMessage", () =>
              pipe(
                schedule,
                Option.map((schedule) =>
                  pipe(
                    Match.value(schedule),
                    Match.tagsExhaustive({
                      PopulatedBreakSchedule: () => [],
                      PopulatedSchedule: (schedule) => schedule.fills,
                    }),
                  ),
                ),
                Option.getOrElse(() => []),
                Array.getSomes,
                Array.map((player) =>
                  pipe(
                    Match.value(player.player),
                    Match.tagsExhaustive({
                      Player: () => Option.none(),
                      PartialNamePlayer: (player) => Option.some(player),
                    }),
                  ),
                ),
                Array.getSomes,
                Option.liftPredicate((arr) => Array.length(arr) > 0),
                Option.map(
                  (partialPlayers) =>
                    `Cannot look up Discord ID for ${pipe(
                      partialPlayers,
                      Array.map((player) => player.name),
                      Array.join(", "),
                    )}. They would need to check in manually.`,
                ),
              ),
            ),
            Effect.map(
              ({ checkinMessage, emptySlotMessage, playersMessage, lookupFailedMessage }) => ({
                checkinMessage,
                managerCheckinMessage: pipe(
                  checkinMessage,
                  Option.match({
                    onSome: () =>
                      pipe(
                        [
                          Option.some("Check-in message sent!"),
                          Option.some(emptySlotMessage),
                          Option.some(playersMessage),
                          lookupFailedMessage,
                        ],
                        Array.getSomes,
                        Array.join("\n"),
                      ),
                    onNone: () => "No check-in message sent, no players changed",
                  }),
                ),
              }),
            ),
          ),
      ),
    })),
  ),
  dependencies: [ConverterService.Default],
  accessors: true,
}) {}
