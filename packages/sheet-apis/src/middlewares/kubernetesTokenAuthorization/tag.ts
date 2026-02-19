import { HttpApiMiddleware, HttpApiSecurity, OpenApi } from "@effect/platform";
import { Unauthorized } from "../error";

export class KubernetesTokenAuthorization extends HttpApiMiddleware.Tag<KubernetesTokenAuthorization>()(
  "KubernetesTokenAuthorization",
  {
    failure: Unauthorized,
    security: {
      kubernetesToken: HttpApiSecurity.bearer.pipe(
        HttpApiSecurity.annotate(
          OpenApi.Description,
          "Require Kubernetes sheet-apis service account token for authorization",
        ),
      ),
    },
  },
) {}
