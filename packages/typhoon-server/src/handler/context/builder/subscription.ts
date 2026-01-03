import { Context } from "typhoon-core/handler";
import type { SubscriptionHandlerT } from "@/handler/subscription/type";

export const builders = () => Context.Builder.builders<SubscriptionHandlerT>();
