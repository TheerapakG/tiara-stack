import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/ready")({
  server: {
    handlers: {
      GET: async () => new Response(null, { status: 200 }),
    },
  },
});
