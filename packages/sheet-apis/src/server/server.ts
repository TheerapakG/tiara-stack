import { Effect, pipe } from "effect";
import { Server } from "typhoon-server/server";
import { calcHandler } from "./handler";

export const server = pipe(
  Server.create(),
  Effect.map(Server.add(calcHandler)),
);
