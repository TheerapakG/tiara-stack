import { Schema } from "effect";

export class ScheduleHourWindow extends Schema.TaggedClass<ScheduleHourWindow>()(
  "ScheduleHourWindow",
  {
    start: Schema.DateTimeUtcFromNumber,
    end: Schema.DateTimeUtcFromNumber,
  },
) {}
