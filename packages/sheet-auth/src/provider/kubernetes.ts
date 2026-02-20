import { createRemoteJWKSet, jwtVerify } from "jose";
import { Provider } from "@openauthjs/openauth/provider/provider";

interface KubernetesProviderConfig {
  /**
   * The URL of the Kubernetes API server.
   * @default "https://kubernetes.default.svc"
   */
  apiServerUrl?: string;
  /**
   * The expected audience for the Kubernetes projected tokens.
   * Tokens must have this audience to be accepted.
   */
  audience: string;
  /**
   * Optional CA certificate for verifying the Kubernetes API server.
   * If not provided, the system CA bundle will be used.
   */
  caCert?: string;
}

interface KubernetesCredentials {
  /**
   * The Kubernetes projected ServiceAccount token.
   */
  token: string;
  /**
   * The Discord user ID to impersonate.
   */
  discordUserId: string;
}

/**
 * Create a Kubernetes provider that validates projected ServiceAccount tokens
 * and allows impersonation of Discord users.
 *
 * This provider is designed to be used with the client_credentials grant type.
 * A service in Kubernetes can present its projected token along with a Discord user ID
 * to obtain an auth subject for that user.
 */
export function KubernetesProvider(
  config: KubernetesProviderConfig,
): Provider<KubernetesCredentials> {
  const apiServerUrl = config.apiServerUrl ?? "https://kubernetes.default.svc";
  const jwksUrl = `${apiServerUrl}/openid/v1/jwks`;

  // Create JWKS client for token verification
  const jwks = createRemoteJWKSet(new URL(jwksUrl), {
    cooldownDuration: 300000, // 5 minutes cooldown between fetches
  });

  return {
    type: "kubernetes",

    // This provider doesn't use the standard OAuth flow
    init() {
      // No routes needed for client_credentials flow
    },

    // Handle client_credentials grant
    async client(input: {
      clientID: string;
      clientSecret: string;
      params: Record<string, string>;
    }): Promise<KubernetesCredentials> {
      const token = input.params.token;
      const discordUserId = input.params.discord_user_id;

      console.log("token", token);
      console.log("discordUserId", discordUserId);

      if (!token) {
        throw new Error("Missing required parameter: token");
      }

      if (!discordUserId) {
        throw new Error("Missing required parameter: discord_user_id");
      }

      try {
        // Verify the Kubernetes token
        const { payload } = await jwtVerify(token, jwks, {
          audience: config.audience,
        });

        // Validate that this is a ServiceAccount token
        if (!payload.sub?.startsWith("system:serviceaccount:")) {
          throw new Error("Invalid token: not a ServiceAccount token");
        }

        // Token is valid and has the correct audience
        // Return the credentials for the success callback
        return {
          token,
          discordUserId,
        };
      } catch (error) {
        throw new Error(
          `Token verification failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    },
  };
}
