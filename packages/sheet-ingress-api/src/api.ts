import { HttpApi, OpenApi } from "effect/unstable/httpapi";
import { SheetApisApi } from "./sheet-apis";
import { SheetBotApi } from "./sheet-bot";

export class Api extends HttpApi.make("sheet-ingress")
  .addHttpApi(SheetApisApi)
  .addHttpApi(SheetBotApi)
  .annotate(OpenApi.Title, "Sheet Ingress API")
  .annotate(OpenApi.Description, "Ingress API for sheet APIs and sheet bot HTTP routes") {}

export { SheetApisApi, SheetBotApi };
