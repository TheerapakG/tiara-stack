import { createFileRoute, Outlet, Link, useChildMatches } from "@tanstack/react-router";
import { Schema, pipe, Effect, Array, Option } from "effect";
import { AnimatePresence, motion } from "motion/react";
import { useAllChannels, getAllChannelsAtom } from "#/lib/schedule";
import { ensureResultAtomData } from "#/lib/atomRegistry";

// Search params schema using Effect Schema
// Timestamp in milliseconds for the selected date
const ScheduleSearchSchema = Schema.Struct({
  timestamp: Schema.Number,
});

export type ScheduleSearchParams = typeof ScheduleSearchSchema.Type;

export const Route = createFileRoute(
  "/_authenticated/dashboard/guilds/$guildId/schedule/$channel/_channelLayout",
)({
  validateSearch: pipe(ScheduleSearchSchema, Schema.standardSchemaV1),
  component: ScheduleLayout,
  loader: async ({ context, params }) => {
    console.log("loading channels");
    await Effect.runPromise(
      ensureResultAtomData(context.atomRegistry, getAllChannelsAtom(params.guildId)).pipe(
        Effect.catchAll(() => Effect.succeed([])),
      ),
    );
    console.log("channels loaded");
  },
});

function ScheduleLayout() {
  const { guildId } = Route.useParams();
  const search = Route.useSearch();
  const childMatches = useChildMatches();

  // Extract view type from route path - explicit check for calendar vs daily
  const viewType = pipe(
    Array.head(childMatches),
    Option.map((match) => {
      // Check routeId explicitly for calendar or daily segment
      if (match.routeId.includes("/daily")) return "daily";
      if (match.routeId.includes("/calendar")) return "calendar";
      return "default";
    }),
    Option.getOrElse(() => "default"),
  );
  const routeKey = `${guildId}-${viewType}`;

  const channels = useAllChannels(guildId);

  return (
    <div className="space-y-6">
      {/* Channel Tabs */}
      {channels.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {channels.map((ch) => (
            <Link
              key={ch}
              to="."
              params={(prev) => ({ ...prev, channel: ch })}
              search={{ timestamp: search.timestamp }}
              activeOptions={{ includeSearch: false, exact: false }}
              className={`
                px-3 py-1.5 text-xs font-bold tracking-wide whitespace-nowrap transition-colors
                [&.active]:bg-[#33ccbb] [&.active]:text-[#0a0f0e]
                bg-[#0f1615] text-white border border-[#33ccbb]/30 hover:bg-[#33ccbb]/10
              `}
            >
              {ch.toUpperCase()}
            </Link>
          ))}
        </div>
      )}

      <AnimatePresence mode="popLayout">
        <motion.div
          key={routeKey}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
        >
          <Outlet />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
