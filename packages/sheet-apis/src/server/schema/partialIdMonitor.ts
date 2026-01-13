import { Schema } from "effect";

export class PartialIdMonitor extends Schema.TaggedClass<PartialIdMonitor>()("PartialIdMonitor", {
  id: Schema.String,
}) {}
