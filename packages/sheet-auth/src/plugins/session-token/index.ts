import { BetterAuthPlugin } from "better-auth";
import { createAuthMiddleware } from "better-auth/plugins";

export const sessionToken = () => {
  return {
    id: "session-token",
    hooks: {
      after: [
        {
          matcher() {
            return true;
          },
          handler: createAuthMiddleware(async (ctx) => {
            const sessionCookieToken = await ctx.getSignedCookie(
              ctx.context.authCookies.sessionToken.name,
              ctx.context.secret,
            );

            if (!sessionCookieToken) {
              return null;
            }

            const exposedHeaders =
              ctx.context.responseHeaders?.get("access-control-expose-headers") || "";
            const headersSet = new Set(
              exposedHeaders
                .split(",")
                .map((header) => header.trim())
                .filter(Boolean),
            );
            headersSet.add("set-auth-token");
            ctx.setHeader("set-auth-token", sessionCookieToken);
            ctx.setHeader("Access-Control-Expose-Headers", Array.from(headersSet).join(", "));
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;
};
