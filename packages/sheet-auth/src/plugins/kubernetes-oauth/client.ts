import { BetterAuthClientPlugin } from "better-auth";
import type { kubernetesOAuth } from "./index";
export type { Permission } from "./index";

export const kubernetesOAuthClient = () => {
  return {
    id: "kubernetes-oauth-client",
    $InferServerPlugin: {} as ReturnType<typeof kubernetesOAuth>,
  } satisfies BetterAuthClientPlugin;
};
