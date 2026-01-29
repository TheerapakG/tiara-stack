import { Schema } from "effect";

export class EventConfig extends Schema.TaggedClass<EventConfig>()("EventConfig", {
  startTime: Schema.DateTimeUtcFromNumber,
}) {}
