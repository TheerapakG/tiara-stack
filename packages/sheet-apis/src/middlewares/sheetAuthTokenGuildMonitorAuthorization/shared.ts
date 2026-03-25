import { Effect, Option } from "effect";
import { getOptionalGuildId } from "../requestGuildId";
import { Unauthorized } from "../../schemas/middlewares/unauthorized";
import { SheetAuthTokenAuthorization } from "../sheetAuthTokenAuthorization/tag";
import { SheetAuthTokenGuildMonitorAuthorization } from "./tag";

const getRequiredGuildId = Effect.gen(function* () {
  const maybeGuildId = yield* getOptionalGuildId;
  if (Option.isSome(maybeGuildId)) {
    return maybeGuildId.value;
  }

  return yield* Effect.fail(
    new Unauthorized({ message: "Request guildId is required for guild monitor authorization" }),
  );
});

const hasMonitorPermission = (permissions: ReadonlyArray<string>, guildId: string) =>
  permissions.includes(`monitor_guild:${guildId}`);

export const makeSheetAuthTokenGuildMonitorAuthorization = (
  sheetAuthTokenAuthorization: SheetAuthTokenAuthorization["Type"],
) =>
  Effect.succeed(
    SheetAuthTokenGuildMonitorAuthorization.of({
      sheetAuthToken: Effect.fnUntraced(function* (token) {
        const user = yield* sheetAuthTokenAuthorization.sheetAuthToken(token);
        const guildId = yield* getRequiredGuildId;
        if (hasMonitorPermission(user.permissions, guildId)) {
          return user;
        }
        return yield* Effect.fail(new Unauthorized({ message: "User is not a guild monitor" }));
      }),
    }),
  );
