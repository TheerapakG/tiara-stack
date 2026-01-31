import { Schema } from "effect";

export class Monitor extends Schema.TaggedClass<Monitor>()("Monitor", {
  index: Schema.Number,
  id: Schema.String,
  name: Schema.String,
}) {}

export class PartialIdMonitor extends Schema.TaggedClass<PartialIdMonitor>()("PartialIdMonitor", {
  id: Schema.String,
}) {}

export class PartialNameMonitor extends Schema.TaggedClass<PartialNameMonitor>()(
  "PartialNameMonitor",
  {
    name: Schema.String,
  },
) {}
