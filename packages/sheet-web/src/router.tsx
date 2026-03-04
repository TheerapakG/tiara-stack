import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupStartAtomIntegration } from "start-atom";
import { routeTree } from "./routeTree.gen";
import { makeAtomRegistry } from "#/lib/atomRegistry";

export function getRouter() {
  const atomRegistry = makeAtomRegistry();

  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    context: {
      atomRegistry,
    },
  });

  setupStartAtomIntegration({
    router,
    registry: atomRegistry,
  });

  return router;
}
