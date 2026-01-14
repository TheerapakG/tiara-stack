import { bold, time, TimestampStyles, userMention } from "discord.js";
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
  flow,
} from "effect";
import { ConverterService, HourWindow } from "./converterService";
import { Schema } from "sheet-apis";

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
    weight: 0.2,
  },
  {
    value:
      "{{mentionsString}} Press the button below to check in, and {{channelString}} {{hourString}} {{timeStampString}}. ... Beep Boop. Beep Boop. zzzt... zzzt... zzzt...",
    weight: 0.1,
  },
  {
    value:
      "{{mentionsString}} Press the button below to check in, and {{channelString}} {{hourString}} {{timeStampString}}\n~~or VBS Miku will recruit you for some taste testing of her cooking.~~",
    weight: 0.1,
  },
  {
    value:
      "{{mentionsString}} Ebi jail AAAAAAAAAAAAAAAAAAAAAAA. Press the button below to check in, and {{channelString}} {{hourString}} {{timeStampString}}",
    weight: 0.1,
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
    Effect.let(
      "formatHourWindow",
      ({ formatDateTime }) =>
        (hourWindow: HourWindow) =>
          new FormattedHourWindow({
            start: formatDateTime(hourWindow.start),
            end: formatDateTime(hourWindow.end),
          }),
    ),
    Effect.map(({ converterService, formatDateTime, formatHourWindow }) => ({
      formatDateTime,
      formatHourWindow,
      formatOpenSlot: (schedule: Schema.BreakSchedule | Schema.Schedule) =>
        pipe(
          Match.value(schedule),
          Match.tagsExhaustive({
            BreakSchedule: () => Effect.succeed(""),
            Schedule: (schedule) =>
              pipe(
                Effect.succeed({
                  hour: schedule.hour,
                  empty: Schema.Schedule.empty(schedule),
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
                    Effect.transposeMapOption(converterService.convertHourToHourWindow),
                    Effect.map(Option.map(formatHourWindow)),
                    Effect.map(
                      flow(
                        Option.map(
                          ({ start, end }) =>
                            `${time(start, TimestampStyles.ShortTime)}-${time(end, TimestampStyles.ShortTime)}`,
                        ),
                        Option.getOrElse(() => "??-??"),
                      ),
                    ),
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
          Effect.withSpan("FormatService.formatOpenSlot", {
            captureStackTrace: true,
          }),
        ),
      formatFilledSlot: (schedule: Schema.BreakSchedule | Schema.Schedule) =>
        pipe(
          Match.value(schedule),
          Match.tagsExhaustive({
            BreakSchedule: () => Effect.succeed(""),
            Schedule: (schedule) =>
              pipe(
                Effect.succeed({
                  hour: schedule.hour,
                  empty: Schema.Schedule.empty(schedule),
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
                    Effect.transposeMapOption(converterService.convertHourToHourWindow),
                    Effect.map(Option.map(formatHourWindow)),
                    Effect.map(
                      flow(
                        Option.map(
                          ({ start, end }) =>
                            `${time(start, TimestampStyles.ShortTime)}-${time(end, TimestampStyles.ShortTime)}`,
                        ),
                        Option.getOrElse(() => "??-??"),
                      ),
                    ),
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
          Effect.withSpan("FormatService.formatFilledSlot", {
            captureStackTrace: true,
          }),
        ),
      formatCheckIn: ({
        prevSchedule,
        schedule,
        channelString,
        template,
      }: {
        prevSchedule: Option.Option<Schema.ScheduleWithPlayers | Schema.BreakSchedule>;
        schedule: Option.Option<Schema.ScheduleWithPlayers | Schema.BreakSchedule>;
        channelString: string;
        template?: string;
      }) =>
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
                    BreakSchedule: () => [],
                    ScheduleWithPlayers: (prevSchedule) => prevSchedule.fills,
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
                    BreakSchedule: () => [],
                    ScheduleWithPlayers: (schedule) => schedule.fills,
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
          Effect.bind("range", ({ hour }) =>
            pipe(
              hour,
              Effect.transposeMapOption(converterService.convertHourToHourWindow),
              Effect.map(Option.map(formatHourWindow)),
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
          Effect.let("timeStampString", ({ range }) =>
            pipe(
              range,
              Option.map(({ start }) => time(start, TimestampStyles.RelativeTime)),
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
                    BreakSchedule: () => 5,
                    ScheduleWithPlayers: (schedule) => Schema.ScheduleWithPlayers.empty(schedule),
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
                    BreakSchedule: () => [],
                    ScheduleWithPlayers: (schedule) => schedule.fills,
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
              Option.liftPredicate(flow(Array.length, Order.greaterThan(Number.Order)(0))),
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
                        Option.some("Checkin message sent!"),
                        Option.some(emptySlotMessage),
                        Option.some(playersMessage),
                        lookupFailedMessage,
                      ],
                      Array.getSomes,
                      Array.join("\n"),
                    ),
                  onNone: () => "No checkin message sent, no players changed",
                }),
              ),
            }),
          ),
          Effect.withSpan("FormatService.formatCheckIn", {
            captureStackTrace: true,
          }),
        ),
    })),
  ),
  accessors: true,
}) {}
