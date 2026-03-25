import { Schema } from "effect";
import { GeneratedRoomOrderEntry } from "./generatedRoomOrderEntry";
import { MessageRoomOrderRange } from "@/schemas/messageRoomOrder";

export class RoomOrderGenerateResult extends Schema.TaggedClass<RoomOrderGenerateResult>()(
  "RoomOrderGenerateResult",
  {
    content: Schema.String,
    range: MessageRoomOrderRange,
    rank: Schema.Number,
    hour: Schema.Number,
    monitor: Schema.NullOr(Schema.String),
    previousFills: Schema.Array(Schema.String),
    fills: Schema.Array(Schema.String),
    entries: Schema.Array(GeneratedRoomOrderEntry),
  },
) {}
