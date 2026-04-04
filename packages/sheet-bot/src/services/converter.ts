import { Data, DateTime, Duration, Effect, Layer, Number, ServiceMap, pipe } from "effect";
import { SheetService } from "./sheet";

export class HourWindow extends Data.TaggedClass("HourWindow")<{
  start: DateTime.DateTime;
  end: DateTime.DateTime;
}> {}

export class ConverterService extends ServiceMap.Service<ConverterService>()("ConverterService", {
  make: Effect.gen(function* () {
    const sheet = yield* SheetService;

    return {
      convertHourToHourWindow: Effect.fn("ConverterService.convertHourToHourWindow")(function* (
        guildId: string,
        hour: number,
      ) {
        const eventConfig = yield* sheet.getEventConfig(guildId);

        return new HourWindow({
          start: pipe(eventConfig.startTime, DateTime.addDuration(Duration.hours(hour - 1))),
          end: pipe(eventConfig.startTime, DateTime.addDuration(Duration.hours(hour))),
        });
      }),
      convertDateTimeToHour: Effect.fn("ConverterService.convertDateTimeToHour")(function* (
        guildId: string,
        dateTime: DateTime.DateTime,
      ) {
        const eventConfig = yield* sheet.getEventConfig(guildId);
        const targetHourStart = pipe(dateTime, DateTime.startOf("hour"));
        const hours = pipe(
          DateTime.distance(eventConfig.startTime, targetHourStart),
          Duration.toHours,
          Math.floor,
          Number.increment,
        );

        return hours;
      }),
      convertDateTimeToHourWindow: Effect.fn("ConverterService.convertDateTimeToHourWindow")(
        function* (dateTime: DateTime.DateTime) {
          return yield* Effect.succeed(
            new HourWindow({
              start: pipe(dateTime, DateTime.startOf("hour")),
              end: pipe(dateTime, DateTime.endOf("hour")),
            }),
          );
        },
      ),
    };
  }),
}) {
  static layer = Layer.effect(ConverterService, this.make).pipe(Layer.provide(SheetService.layer));
}
