import { Schema } from "effect";
import { HourRange } from "./hourRange";

export class RunnerConfig extends Schema.TaggedClass<RunnerConfig>()("RunnerConfig", {
  name: Schema.OptionFromNullOr(Schema.String),
  hours: Schema.Array(HourRange),
}) {}
