import { Client } from "discord.js";
import { Effect, Function, Layer, pipe } from "effect";
import {
  ChannelContext,
  ChannelKind,
  ChannelT,
  GuildBasedChannelT,
  GuildTextBasedChannelT,
} from "../channel";
import { GuildService } from "../guild";
import { CachedInteractionContext, ClientService } from "../interaction";

export const channelServices = <C extends ChannelT>(channel: ChannelKind<C>) =>
  pipe(
    Layer.mergeAll(
      ClientService.Default(channel.client as Client<true>),
      Layer.succeedContext(ChannelContext.make<C>(channel)),
    ),
    Effect.succeed,
    Effect.withSpan("channelServices", {
      captureStackTrace: true,
      attributes: {
        channelId: channel.id,
      },
    }),
    Layer.unwrapEffect,
  );

export const channelServicesFromInteraction = () =>
  pipe(
    CachedInteractionContext.channel(true),
    Effect.map((channel) => channelServices<GuildTextBasedChannelT>(channel)),
    Effect.withSpan("channelServicesFromInteraction", {
      captureStackTrace: true,
    }),
    Layer.unwrapEffect,
  );

export const channelServicesFromGuildChannelId = (channelId: string) =>
  pipe(
    GuildService.fetchChannel(channelId),
    Effect.flatMap(Function.identity),
    Effect.map((channel) => channelServices<GuildBasedChannelT>(channel)),
    Effect.withSpan("channelServicesFromGuildChannelId", {
      captureStackTrace: true,
    }),
    Layer.unwrapEffect,
  );
