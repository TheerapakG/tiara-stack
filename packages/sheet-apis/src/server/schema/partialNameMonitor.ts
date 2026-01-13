import { Schema } from "effect";

export class PartialNameMonitor extends Schema.TaggedClass<PartialNameMonitor>()(
  "PartialNameMonitor",
  {
    name: Schema.String,
  },
) {}
