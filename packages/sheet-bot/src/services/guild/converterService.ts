import { Data, DateTime, Duration, Either, Effect, Number, pipe, flow } from "effect";
import { SheetService } from "./sheetService";

export class HourWindow extends Data.TaggedClass("HourWindow")<{
  start: DateTime.DateTime;
  end: DateTime.DateTime;
}> {}

export class ConverterService extends Effect.Service<ConverterService>()("ConverterService", {
  effect: pipe(
    Effect.Do,
    Effect.bind("sheetService", () => SheetService),
    Effect.map(({ sheetService }) => ({
      convertHourToHourWindow: (hour: number) =>
        pipe(
          sheetService.eventConfig(),
          Effect.map(
            (eventConfig) =>
              new HourWindow({
                start: pipe(eventConfig.startTime, DateTime.addDuration(Duration.hours(hour - 1))),
                end: pipe(eventConfig.startTime, DateTime.addDuration(Duration.hours(hour))),
              }),
          ),
          Effect.withSpan("ConverterService.convertHourToHourWindow", {
            captureStackTrace: true,
          }),
        ),
      convertDateTimeToHour: (dateTime: DateTime.DateTime) =>
        pipe(
          sheetService.eventConfig(),
          Effect.map((eventConfig) => eventConfig.startTime),
          Effect.map(DateTime.distanceDurationEither(pipe(dateTime, DateTime.startOf("hour")))),
          Effect.map(
            Either.match({
              onRight: Duration.toHours,
              onLeft: flow(Duration.toHours, Number.negate),
            }),
          ),
          Effect.map(Math.floor),
          Effect.map(Number.increment),
          Effect.withSpan("ConverterService.convertHourToHourWindow", {
            captureStackTrace: true,
          }),
        ),

      convertDateTimeToHourWindow: (dateTime: DateTime.DateTime) =>
        pipe(
          Effect.succeed(
            new HourWindow({
              start: pipe(dateTime, DateTime.startOf("hour")),
              end: pipe(dateTime, DateTime.endOf("hour")),
            }),
          ),
          Effect.withSpan("ConverterService.convertDateTimeToHourWindow", {
            captureStackTrace: true,
          }),
        ),
    })),
  ),
  accessors: true,
}) {}
