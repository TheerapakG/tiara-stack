import { HttpApi, OpenApi } from "effect/unstable/httpapi";
import {
  CalcApi,
  CheckinApi,
  DispatchApi,
  DiscordApi,
  GuildConfigApi,
  HealthApi,
  MessageCheckinApi,
  MessageRoomOrderApi,
  MessageSlotApi,
  MonitorApi,
  PermissionsApi,
  PlayerApi,
  RoomOrderApi,
  ScheduleApi,
  ScreenshotApi,
  SheetApi,
} from "./api-groups";

export class SheetApisApi extends HttpApi.make("api")
  .add(CalcApi)
  .add(CheckinApi)
  .add(DispatchApi)
  .add(HealthApi)
  .add(GuildConfigApi)
  .add(MessageCheckinApi)
  .add(MessageRoomOrderApi)
  .add(MessageSlotApi)
  .add(PermissionsApi)
  .add(SheetApi)
  .add(MonitorApi)
  .add(PlayerApi)
  .add(RoomOrderApi)
  .add(ScreenshotApi)
  .add(ScheduleApi)
  .add(DiscordApi)
  .annotate(OpenApi.Title, "Sheet APIs") {}
