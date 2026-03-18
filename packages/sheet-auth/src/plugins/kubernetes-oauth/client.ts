import { BetterAuthClientPlugin } from "better-auth";
import type { kubernetesOAuth } from "./index";
export { PermissionValues } from "./shared";
export type { Permission } from "./shared";

export const kubernetesOAuthClient = () => {
  return {
    id: "kubernetes-oauth-client",
    $InferServerPlugin: {} as ReturnType<typeof kubernetesOAuth>,
  } satisfies BetterAuthClientPlugin;
};
