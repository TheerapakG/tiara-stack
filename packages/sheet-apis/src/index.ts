import { serve as crosswsServe } from "crossws/server/node";
import { Effect, pipe } from "effect";
import { InferServerType, serve } from "typhoon-server/server";
import { server } from "./server";

export type Server = InferServerType<typeof server>;

const serveEffect = pipe(server, Effect.flatMap(serve(crosswsServe)));

Effect.runPromise(serveEffect);
