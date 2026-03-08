import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { Array, Effect, Option, Schema, pipe } from "effect";
import { getAllChannelsAtom } from "#/lib/schedule";
import { getCurrentTimestamp } from "#/lib/utils";
import { ensureResultAtomData } from "#/lib/atomRegistry";
import { motion } from "motion/react";

const ScheduleSearchSchema = Schema.Struct({
  timestamp: Schema.optional(Schema.Number),
});

export const Route = createFileRoute("/_authenticated/dashboard/guilds/$guildId/schedule")({
  component: ScheduleRedirect,
  validateSearch: pipe(ScheduleSearchSchema, Schema.standardSchemaV1),
  beforeLoad: async ({ params, search, context }) => {
    if (search.timestamp) {
      return;
    }

    console.log("before-loading channels");
    const channels = await Effect.runPromise(
      ensureResultAtomData(context.atomRegistry, getAllChannelsAtom(params.guildId), {
        revalidateIfStale: true,
      }).pipe(Effect.catchAll(() => Effect.succeed([]))),
    );
    console.log("channels before-loaded");

    const defaultChannel = Array.head(channels);

    return Option.match(defaultChannel, {
      onSome: (channel) => {
        throw redirect({
          to: "/dashboard/guilds/$guildId/schedule/$channel/calendar",
          params: { guildId: params.guildId, channel },
          search: { timestamp: getCurrentTimestamp() },
        });
      },
      onNone: () => undefined,
    });
  },
});

function ScheduleRedirect() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
    >
      <Outlet />
    </motion.div>
  );
}
