import { HttpApi, OpenApi } from "@effect/platform";
import { ZeroApi } from "./zero/api";

export class Api extends HttpApi.make("api").add(ZeroApi).annotate(OpenApi.Title, "Sheet DB API") {}
