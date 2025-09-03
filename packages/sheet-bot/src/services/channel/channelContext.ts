import {
  BaseChannel,
  Channel,
  GuildBasedChannel,
  GuildTextBasedChannel,
  MessageCreateOptions,
  MessagePayload,
  PartialDMChannel,
  SendableChannels,
} from "discord.js";
import { Context, Data, Effect, HKT, Types, pipe } from "effect";
import { DiscordError } from "~~/src/types";
import { wrap } from "~~/src/utils";

export interface BaseChannelT extends HKT.TypeLambda {
  readonly type: BaseChannel;
}

export interface ChannelT extends HKT.TypeLambda {
  readonly type: Exclude<Channel, PartialDMChannel>;
}

export interface SendableChannelT extends HKT.TypeLambda {
  readonly type: Exclude<SendableChannels, PartialDMChannel>;
}

export interface GuildTextBasedChannelT extends HKT.TypeLambda {
  readonly type: GuildTextBasedChannel;
}

export interface GuildBasedChannelT extends HKT.TypeLambda {
  readonly type: GuildBasedChannel;
}

export type ChannelKind<F extends BaseChannelT> = HKT.Kind<
  F,
  never,
  never,
  never,
  never
>;

export class ChannelContext<C extends BaseChannelT = ChannelT> {
  $inferChannelType: Types.Contravariant<C> =
    undefined as unknown as Types.Contravariant<C>;

  static channel<C extends BaseChannelT = ChannelT>() {
    return Context.GenericTag<ChannelContext<C>, ChannelKind<C>>(
      "ChannelContext",
    );
  }

  static make<C extends BaseChannelT>(channel: ChannelKind<C>) {
    return Context.make(this.channel<C>(), channel);
  }
}

export class UnsendableChannelError extends Data.TaggedError(
  "UnsendableChannelError",
)<{
  readonly message: string;
}> {
  constructor() {
    super({ message: "Channel is not text-based and cannot send messages." });
  }
}

export class SendableChannelContext {
  static channel<
    C extends BaseChannelT = ChannelT,
    Kind extends ChannelKind<C> &
      ChannelKind<SendableChannelT> = ChannelKind<C> &
      ChannelKind<SendableChannelT>,
  >() {
    return pipe(
      ChannelContext.channel<C>(),
      Effect.flatMap((channel) =>
        channel.isSendable()
          ? Effect.succeed(channel as Kind)
          : Effect.fail(new UnsendableChannelError()),
      ),
      Effect.withSpan("SendableChannelContext.channel", {
        captureStackTrace: true,
      }),
    );
  }

  static send = <
    C extends BaseChannelT = ChannelT,
    Kind extends ChannelKind<C> &
      ChannelKind<SendableChannelT> = ChannelKind<C> &
      ChannelKind<SendableChannelT>,
  >() =>
    wrap((options: string | MessagePayload | MessageCreateOptions) =>
      pipe(
        SendableChannelContext.channel<C, Kind>(),
        Effect.flatMap((channel: Kind) =>
          DiscordError.wrapTryPromise(
            () =>
              channel.send(options) as Promise<
                Awaited<ReturnType<Kind["send"]>>
              >,
          ),
        ),
        Effect.withSpan("SendableChannelContext.send", {
          captureStackTrace: true,
        }),
      ),
    );
}
