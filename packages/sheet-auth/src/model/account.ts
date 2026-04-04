import { Schema } from "effect";

const AccountData = {
  scopes: Schema.Array(Schema.String),
  userId: Schema.String,
  accountId: Schema.String,
  providerId: Schema.String,
  createdAt: Schema.DateTimeUtcFromMillis,
  updatedAt: Schema.DateTimeUtcFromMillis,
};

export class Account extends Schema.TaggedClass<Account>()("Account", AccountData) {}
