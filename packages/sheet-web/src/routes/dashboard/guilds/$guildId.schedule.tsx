import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { Registry } from "@effect-atom/atom-react";
import { Array, Effect, Option, Schema, pipe } from "effect";
import { getAllChannelsAtom } from "#/lib/schedule";
import { getCurrentTimestamp } from "#/lib/utils";

const ScheduleSearchSchema = Schema.Struct({
  timestamp: Schema.optional(Schema.Number),
});

export const Route = createFileRoute("/dashboard/guilds/$guildId/schedule")({
  component: ScheduleRedirect,
  validateSearch: pipe(ScheduleSearchSchema, Schema.standardSchemaV1),
  beforeLoad: async ({ params, search, context }) => {
    if (search.timestamp) {
      return;
    }

    const channels = await Effect.runPromise(
      Registry.getResult(context.atomRegistry, getAllChannelsAtom(params.guildId)).pipe(
        Effect.catchAll(() => Effect.succeed([])),
      ),
    );

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
  return <Outlet />;
}
