import { HttpApi, OpenApi } from "@effect/platform";
import { CalcApi } from "./handlers/calc/api";
import { HealthApi } from "./handlers/health/api";
import { GuildConfigApi } from "./handlers/guildConfig/api";
import { MessageCheckinApi } from "./handlers/messageCheckin/api";
import { MessageRoomOrderApi } from "./handlers/messageRoomOrder/api";
import { MessageSlotApi } from "./handlers/messageSlot/api";
import { SheetApi } from "./handlers/sheet/api";
import { MonitorApi } from "./handlers/monitor/api";
import { PlayerApi } from "./handlers/player/api";
import { ScreenshotApi } from "./handlers/screenshot/api";
import { ScheduleApi } from "./handlers/schedule/api";

export class Api extends HttpApi.make("api")
  .add(CalcApi)
  .add(HealthApi)
  .add(GuildConfigApi)
  .add(MessageCheckinApi)
  .add(MessageRoomOrderApi)
  .add(MessageSlotApi)
  .add(SheetApi)
  .add(MonitorApi)
  .add(PlayerApi)
  .add(ScreenshotApi)
  .add(ScheduleApi)
  .annotate(OpenApi.Title, "Sheet APIs") {}
