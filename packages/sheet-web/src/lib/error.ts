import { Schema } from "effect";

export class RequestError extends Schema.TaggedErrorClass<RequestError>()("RequestError", {}) {}
