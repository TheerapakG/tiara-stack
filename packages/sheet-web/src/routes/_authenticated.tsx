import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { Effect, Option } from "effect";
import { ensureResultAtomData } from "#/lib/atomRegistry";
import { sessionAtom } from "#/lib/auth";

export const Route = createFileRoute("/_authenticated")({
  component: RouteComponent,
  beforeLoad: async ({ context }) => {
    console.log("before-loading session");
    const session = await Effect.runPromise(
      ensureResultAtomData(context.atomRegistry, sessionAtom),
    );
    console.log("session before-loaded");
    // Redirect to home if not authenticated
    if (Option.isNone(session)) {
      throw redirect({ to: "/" });
    }
  },
});

function RouteComponent() {
  return <Outlet />;
}
