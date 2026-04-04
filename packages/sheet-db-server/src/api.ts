import { HttpApi, OpenApi } from "effect/unstable/httpapi";
import { ZeroApi } from "./handlers/zero/api";

export class Api extends HttpApi.make("api").add(ZeroApi).annotate(OpenApi.Title, "Sheet DB API") {}
