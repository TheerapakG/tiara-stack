import { HttpApi, OpenApi } from "effect/unstable/httpapi";
import { ZeroHttpApi } from "typhoon-zero/server";

export class Api extends HttpApi.make("api")
  .add(ZeroHttpApi)
  .annotate(OpenApi.Title, "Sheet DB API") {}
