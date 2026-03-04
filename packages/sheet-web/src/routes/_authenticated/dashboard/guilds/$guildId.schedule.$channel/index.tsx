import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_authenticated/dashboard/guilds/$guildId/schedule/$channel/",
)({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-white/60 font-medium tracking-wide">NO CHANNELS AVAILABLE</div>
    </div>
  );
}
