import { Schema } from "effect";

const AccountData = {
  scopes: Schema.Array(Schema.String),
  userId: Schema.String,
  accountId: Schema.String,
  providerId: Schema.String,
  createdAt: Schema.DateTimeUtcFromNumber,
  updatedAt: Schema.DateTimeUtcFromNumber,
};

const AccountTaggedClass: Schema.TaggedClass<
  Account,
  "Account",
  {
    readonly _tag: Schema.tag<"Account">;
  } & {
    readonly [K in keyof typeof AccountData]: (typeof AccountData)[K];
  }
> = Schema.TaggedClass<Account>()("Account", AccountData);

export class Account extends AccountTaggedClass {}
