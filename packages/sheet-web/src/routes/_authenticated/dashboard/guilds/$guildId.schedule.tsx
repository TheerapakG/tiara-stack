import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { Array, DateTime, Effect, Option, Schema, pipe } from "effect";
import { getAllChannelsAtom } from "#/lib/schedule";
import { ensureResultAtomData } from "#/lib/atomRegistry";

const ScheduleSearchSchema = Schema.Struct({
  timestamp: Schema.optional(Schema.Number),
});

export const Route = createFileRoute("/_authenticated/dashboard/guilds/$guildId/schedule")({
  component: ScheduleRedirect,
  validateSearch: pipe(ScheduleSearchSchema, Schema.toStandardSchemaV1),
  beforeLoad: async ({ params, search, context }) => {
    if (search.timestamp !== undefined) {
      return;
    }

    const channels = await Effect.runPromise(
      ensureResultAtomData(context.atomRegistry, getAllChannelsAtom(params.guildId), {
        revalidateIfStale: true,
      }).pipe(Effect.catch(() => Effect.succeed([]))),
    );

    const defaultChannel = Array.head(channels);
    const now = Effect.runSync(DateTime.now);

    return Option.match(defaultChannel, {
      onSome: (channel) => {
        throw redirect({
          to: "/dashboard/guilds/$guildId/schedule/$channel/calendar",
          params: { guildId: params.guildId, channel },
          search: { timestamp: DateTime.toEpochMillis(now) },
        });
      },
      onNone: () => undefined,
    });
  },
});

function ScheduleRedirect() {
  return <Outlet />;
}
