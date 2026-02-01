import { HttpApiMiddleware, HttpApiSchema, HttpApiSecurity, OpenApi } from "@effect/platform";
import { Schema } from "effect";

export class Unauthorized extends Schema.TaggedError<Unauthorized>()(
  "Unauthorized",
  { message: Schema.String, cause: Schema.Unknown },
  HttpApiSchema.annotations({ status: 401 }),
) {}

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
