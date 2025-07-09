import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  Interaction,
  InteractionButtonComponentData,
  SharedSlashCommand,
} from "discord.js";
import { Effect, HashMap } from "effect";

export type InteractionHandler<
  in I extends Interaction,
  out E = unknown,
  out R = unknown,
> = (interaction: I) => Effect.Effect<unknown, E, R>;

export type ButtonInteractionHandler<out E = unknown, out R = unknown> = {
  data: InteractionButtonComponentData;
  handler: InteractionHandler<ButtonInteraction, E, R>;
};

export type ChatInputCommandHandler<out E = unknown, out R = unknown> = {
  data: SharedSlashCommand;
  handler: InteractionHandler<ChatInputCommandInteraction, E, R>;
};

export const defineButtonInteractionHandler = <E = unknown, R = unknown>(
  data: InteractionButtonComponentData,
  handler: InteractionHandler<ButtonInteraction, E, R>,
): ButtonInteractionHandler<E, R> => ({
  data,
  handler,
});

export const defineChatInputCommandHandler = <E = unknown, R = unknown>(
  data: SharedSlashCommand,
  handler: InteractionHandler<ChatInputCommandInteraction, E, R>,
): ChatInputCommandHandler<E, R> => ({
  data,
  handler,
});

export class ChatInputCommandHandlerMap<out E = never, out R = never> {
  private readonly map: HashMap.HashMap<string, ChatInputCommandHandler<E, R>>;

  constructor(map: HashMap.HashMap<string, ChatInputCommandHandler<E, R>>) {
    this.map = map;
  }

  static empty<E = never, R = never>() {
    return new ChatInputCommandHandlerMap<E, R>(HashMap.empty());
  }

  static add<E = never, R = never>(handler: ChatInputCommandHandler<E, R>) {
    return <ME = never, MR = never>(map: ChatInputCommandHandlerMap<ME, MR>) =>
      new ChatInputCommandHandlerMap(
        HashMap.set(
          map.map as HashMap.HashMap<
            string,
            ChatInputCommandHandler<ME | E, MR | R>
          >,
          handler.data.name,
          handler,
        ),
      );
  }

  static reduce<Z, E = never, R = never>(
    map: ChatInputCommandHandlerMap<E, R>,
    zero: Z,
    f: (accumulator: Z, value: ChatInputCommandHandler<E, R>, key: string) => Z,
  ) {
    return HashMap.reduce(map.map, zero, f);
  }

  static values<E = never, R = never>(map: ChatInputCommandHandlerMap<E, R>) {
    return HashMap.values(map.map);
  }
}

export class ButtonInteractionHandlerMap<out E = never, out R = never> {
  private readonly map: HashMap.HashMap<string, ButtonInteractionHandler<E, R>>;

  constructor(map: HashMap.HashMap<string, ButtonInteractionHandler<E, R>>) {
    this.map = map;
  }

  static empty<E = never, R = never>() {
    return new ButtonInteractionHandlerMap<E, R>(HashMap.empty());
  }

  static add<E = never, R = never>(handler: ButtonInteractionHandler<E, R>) {
    return <ME = never, MR = never>(map: ButtonInteractionHandlerMap<ME, MR>) =>
      new ButtonInteractionHandlerMap(
        HashMap.set(
          map.map as HashMap.HashMap<
            string,
            ButtonInteractionHandler<ME | E, MR | R>
          >,
          handler.data.customId,
          handler,
        ),
      );
  }

  static reduce<Z, E = never, R = never>(
    map: ButtonInteractionHandlerMap<E, R>,
    zero: Z,
    f: (
      accumulator: Z,
      value: ButtonInteractionHandler<E, R>,
      key: string,
    ) => Z,
  ) {
    return HashMap.reduce(map.map, zero, f);
  }

  static values<E = never, R = never>(map: ButtonInteractionHandlerMap<E, R>) {
    return HashMap.values(map.map);
  }
}
