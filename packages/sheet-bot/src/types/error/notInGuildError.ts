import { Data } from "effect";

export class NotInGuildError extends Data.TaggedError("NotInGuildError")<{
  readonly message: string;
}> {
  constructor() {
    super({
      message: "Interacting with this is not allowed outside of a guild.",
    });
  }
}
