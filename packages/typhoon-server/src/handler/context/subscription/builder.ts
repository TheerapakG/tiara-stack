import { Context } from "typhoon-core/handler";
import type { SubscriptionHandlerT } from "./type";

export const builders = () => Context.Builder.builders<SubscriptionHandlerT>();
