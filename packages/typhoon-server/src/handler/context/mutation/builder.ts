import { Context } from "typhoon-core/handler";
import type { MutationHandlerT } from "./type";

export const builders = () => Context.Builder.builders<MutationHandlerT>();
