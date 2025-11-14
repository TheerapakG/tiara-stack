import { Record } from "effect";
import { ANYONE_CAN, definePermissions } from "@rocicorp/zero";
import { schema, type Schema } from "./schema";

export { schema, type Schema };

export const permissions = definePermissions<unknown, Schema>(schema, () =>
  Record.map(schema.tables, () => ({
    row: {
      select: ANYONE_CAN,
      insert: ANYONE_CAN,
      update: {
        preMutation: ANYONE_CAN,
        postMutation: ANYONE_CAN,
      },
    },
    delete: ANYONE_CAN,
  })),
);
