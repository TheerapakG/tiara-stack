import { HttpApi, HttpApiGroup, OpenApi } from "effect/unstable/httpapi";
import { DiscordApi } from "dfx-discord-utils/discord/api";
import {
  CalcApi,
  CheckinApi,
  DiscordApi as SheetApisDiscordApi,
  GuildConfigApi,
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
import { SheetApisApi } from "./sheet-apis";

const withIngressApiAnnotations = <Id extends string, Groups extends HttpApiGroup.Any>(
  api: HttpApi.HttpApi<Id, Groups>,
): HttpApi.HttpApi<Id, Groups> =>
  api
    .annotate(OpenApi.Title, "Sheet Ingress API")
    .annotate(
      OpenApi.Description,
      "Ingress API for sheet APIs and sheet bot HTTP routes",
    ) as HttpApi.HttpApi<Id, Groups>;

class SheetIngressSheetApisApi extends HttpApi.make("api")
  .add(CalcApi)
  .add(CheckinApi)
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
  .add(SheetApisDiscordApi)
  .annotate(OpenApi.Title, "Sheet APIs") {}

// Effect's fluent HttpApi builder loses the concrete group union after annotate.
// Keep annotations in this helper so the addHttpApi chain remains the source of truth.
const ApiBase = withIngressApiAnnotations(
  HttpApi.make("sheet-ingress").addHttpApi(SheetIngressSheetApisApi).addHttpApi(DiscordApi),
);

export class Api extends ApiBase {}

export { SheetApisApi };
export { DiscordApi as SheetIngressDiscordApi };
