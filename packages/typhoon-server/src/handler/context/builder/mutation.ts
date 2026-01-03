import { Context } from "typhoon-core/handler";
import type { MutationHandlerT } from "@/handler/mutation/type";

export const builders = () => Context.Builder.builders<MutationHandlerT>();
