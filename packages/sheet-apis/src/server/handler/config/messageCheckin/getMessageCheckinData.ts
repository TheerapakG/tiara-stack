import { Error, MessageCheckin } from "@/server/schema";
import { pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";
import { Result } from "typhoon-core/schema";

export const getMessageCheckinDataHandlerConfig = pipe(
  Handler.Config.empty(),
  Handler.Config.Builder.type("subscription"),
  Handler.Config.Builder.name("messageCheckin.getMessageCheckinData"),
  Handler.Config.Builder.requestParams({
    validator: pipe(Schema.String, Schema.standardSchemaV1),
  }),
  Handler.Config.Builder.response({
    validator: pipe(
      Result.ResultSchema({
        optimistic: Schema.Either({
          right: MessageCheckin,
          left: Schema.Union(Error.Core.ArgumentError, Error.Core.ZeroQueryError),
        }),
        complete: Schema.Either({
          right: MessageCheckin,
          left: Schema.Union(Error.Core.ArgumentError, Error.Core.ZeroQueryError),
        }),
      }),
      Schema.standardSchemaV1,
    ),
  }),
  Handler.Config.Builder.responseError({
    validator: pipe(
      Schema.Union(
        Error.Core.AuthorizationError,
        Error.Core.MsgpackDecodeError,
        Error.Core.StreamExhaustedError,
        Error.Core.ValidationError,
      ),
      Schema.standardSchemaV1,
    ),
  }),
);
