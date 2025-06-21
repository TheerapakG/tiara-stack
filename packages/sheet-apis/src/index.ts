import { serve as crosswsServe } from "crossws/server/node";
import { Effect, pipe } from "effect";
import { serve } from "typhoon-server/server";
import { server } from "./server";

const serveEffect = pipe(
  server,
  Effect.flatMap((server) => serve(crosswsServe, server)),
);

Effect.runPromise(serveEffect);
