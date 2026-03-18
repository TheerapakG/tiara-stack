import { Effect } from "effect";
import { Unauthorized } from "../../schemas/middlewares/unauthorized";
import { SheetAuthTokenAuthorization } from "../sheetAuthTokenAuthorization/tag";
import { SheetAuthTokenGuildMonitorAuthorization } from "./tag";

const hasMonitorPermission = (permissions: ReadonlyArray<string>) =>
  permissions.includes("bot:monitor_guild") || permissions.includes("user:monitor_guild");

export const makeSheetAuthTokenGuildMonitorAuthorization = (
  sheetAuthTokenAuthorization: SheetAuthTokenAuthorization["Type"],
) =>
  Effect.succeed(
    SheetAuthTokenGuildMonitorAuthorization.of({
      sheetAuthToken: Effect.fnUntraced(function* (token) {
        const user = yield* sheetAuthTokenAuthorization.sheetAuthToken(token);
        if (hasMonitorPermission(user.permissions)) {
          return user;
        }
        return yield* Effect.fail(new Unauthorized({ message: "User is not a guild monitor" }));
      }),
    }),
  );
