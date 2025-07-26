import { match } from "arktype";
import {
  ApplicationCommandType,
  ButtonInteraction,
  ChatInputCommandInteraction,
  Client,
  CommandInteraction,
  ComponentType,
  Events,
  GatewayIntentBits,
  Interaction,
  InteractionType,
  MessageComponentInteraction,
  MessageFlags,
} from "discord.js";
import {
  Cause,
  Effect,
  Exit,
  Layer,
  Option,
  pipe,
  Scope,
  SynchronizedRef,
} from "effect";
import { Config } from "../config";
import {
  AnyButtonInteractionHandlerContext,
  AnyChatInputCommandHandlerContext,
  ButtonInteractionHandlerMap,
  ChatInputCommandHandlerMap,
} from "../types";

class ScopeLayer<E = never, R = never> {
  constructor(
    private readonly scope: Scope.CloseableScope,
    private readonly layer: Layer.Layer<R, E>,
  ) {}

  static make<E = never, R = never>(layer: Layer.Layer<R, E>) {
    return pipe(
      Effect.Do,
      Effect.bind("scope", () => Scope.make()),
      Effect.bind("layer", ({ scope }) =>
        pipe(Layer.memoize(layer), Scope.extend(scope)),
      ),
      Effect.map(({ scope, layer }) => new ScopeLayer(scope, layer)),
    );
  }

  static provide<E = never, R = never>(scopeLayer: ScopeLayer<E, R>) {
    return Effect.provide(scopeLayer.layer);
  }

  static close<E = never, R = never>(scopeLayer: ScopeLayer<E, R>) {
    return Scope.close(scopeLayer.scope, Exit.void);
  }
}

export class Bot<E = never, R = never> {
  constructor(
    private readonly client: Client,
    private readonly loginLatch: Effect.Latch,
    private readonly loginSemaphore: Effect.Semaphore,
    private readonly chatInputCommandsMap: SynchronizedRef.SynchronizedRef<
      ChatInputCommandHandlerMap<E, R>
    >,
    private readonly buttonsMap: SynchronizedRef.SynchronizedRef<
      ButtonInteractionHandlerMap<E, R>
    >,
    private readonly traceProvider: Layer.Layer<never>,
    private readonly layer: Layer.Layer<R, E>,
    private readonly scopeLayer: SynchronizedRef.SynchronizedRef<
      Option.Option<ScopeLayer<E, R>>
    >,
  ) {}

  static onChatInputCommandInteraction(
    interaction: ChatInputCommandInteraction,
  ) {
    return <E = never, R = never>(bot: Bot<E, R>) =>
      pipe(
        SynchronizedRef.get(bot.chatInputCommandsMap),
        Effect.map((commandsMap) =>
          ChatInputCommandHandlerMap.get(interaction.commandName)(commandsMap),
        ),
        Effect.flatMap(
          Option.match({
            onSome: (command) =>
              pipe(
                SynchronizedRef.get(bot.scopeLayer),
                Effect.flatMap(
                  Option.match({
                    onSome: (scopeLayer) =>
                      pipe(
                        command.handler(interaction),
                        ScopeLayer.provide(scopeLayer),
                      ),
                    onNone: () => Effect.void,
                  }),
                ),
              ),
            onNone: () => Effect.void,
          }),
        ),
        Effect.exit,
        Effect.flatMap(
          Exit.match({
            onSuccess: (value) => Effect.succeed(value),
            onFailure: (cause) =>
              pipe(
                Effect.Do,
                Effect.tap(() => Effect.log(cause)),
                Effect.let("pretty", () => Cause.pretty(cause)),
                Effect.tap(({ pretty }) =>
                  interaction.replied || interaction.deferred
                    ? Effect.promise(() =>
                        interaction.followUp({
                          content: pretty,
                          flags: MessageFlags.Ephemeral,
                        }),
                      )
                    : Effect.promise(() =>
                        interaction.reply({
                          content: pretty,
                          flags: MessageFlags.Ephemeral,
                        }),
                      ),
                ),
                // TODO: handle errors
                Effect.exit,
              ),
          }),
        ),
      );
  }

  static onCommandInteraction(interaction: CommandInteraction) {
    return <E = never, R = never>(bot: Bot<E, R>) =>
      match({})
        .case(`${ApplicationCommandType.ChatInput}`, () =>
          Bot.onChatInputCommandInteraction(
            interaction as ChatInputCommandInteraction,
          )(bot),
        )
        .default(() => Effect.void)(interaction.commandType);
  }

  static onButtonInteraction(interaction: ButtonInteraction) {
    return <E = never, R = never>(bot: Bot<E, R>) =>
      pipe(
        SynchronizedRef.get(bot.buttonsMap),
        Effect.map((buttonsMap) =>
          ButtonInteractionHandlerMap.get(interaction.customId)(buttonsMap),
        ),
        Effect.flatMap(
          Option.match({
            onSome: (command) =>
              pipe(
                SynchronizedRef.get(bot.scopeLayer),
                Effect.flatMap(
                  Option.match({
                    onSome: (scopeLayer) =>
                      pipe(
                        command.handler(interaction),
                        ScopeLayer.provide(scopeLayer),
                      ),
                    onNone: () => Effect.void,
                  }),
                ),
              ),
            onNone: () => Effect.void,
          }),
        ),
        Effect.exit,
        Effect.flatMap(
          Exit.match({
            onSuccess: (value) => Effect.succeed(value),
            onFailure: (cause) =>
              pipe(
                Effect.Do,
                Effect.tap(() => Effect.log(cause)),
                Effect.let("pretty", () => Cause.pretty(cause)),
                Effect.tap(({ pretty }) =>
                  interaction.replied || interaction.deferred
                    ? Effect.promise(() =>
                        interaction.followUp({
                          content: pretty,
                          flags: MessageFlags.Ephemeral,
                        }),
                      )
                    : Effect.promise(() =>
                        interaction.reply({
                          content: pretty,
                          flags: MessageFlags.Ephemeral,
                        }),
                      ),
                ),
                // TODO: handle errors
                Effect.exit,
              ),
          }),
        ),
      );
  }

  static onMessageComponentInteraction(
    interaction: MessageComponentInteraction,
  ) {
    return <E = never, R = never>(bot: Bot<E, R>) =>
      match({})
        .case(`${ComponentType.Button}`, () =>
          Bot.onButtonInteraction(interaction as ButtonInteraction)(bot),
        )
        .default(() => Effect.void)(interaction.componentType);
  }

  static onInteraction(interaction: Interaction) {
    return <E = never, R = never>(bot: Bot<E, R>) =>
      match({})
        .case(`${InteractionType.ApplicationCommand}`, () =>
          Bot.onCommandInteraction(interaction as CommandInteraction)(bot),
        )
        .case(`${InteractionType.MessageComponent}`, () =>
          Bot.onMessageComponentInteraction(
            interaction as MessageComponentInteraction,
          )(bot),
        )
        .default(() => Effect.void)(interaction.type);
  }

  static create<E = never, R = never>(layer: Layer.Layer<R, E>) {
    return pipe(
      Effect.Do,
      Effect.let(
        "client",
        () => new Client({ intents: [GatewayIntentBits.Guilds] }),
      ),
      Effect.bind("loginLatch", () => Effect.makeLatch(false)),
      Effect.bind("loginSemaphore", () => Effect.makeSemaphore(1)),
      Effect.bind("chatInputCommandsMap", () =>
        SynchronizedRef.make(ChatInputCommandHandlerMap.empty<E, R>()),
      ),
      Effect.bind("buttonsMap", () =>
        SynchronizedRef.make(ButtonInteractionHandlerMap.empty<E, R>()),
      ),
      Effect.bind("scopeLayer", () =>
        SynchronizedRef.make(Option.none<ScopeLayer<E, R>>()),
      ),
      Effect.let(
        "bot",
        ({
          client,
          loginLatch,
          loginSemaphore,
          chatInputCommandsMap,
          buttonsMap,
          scopeLayer,
        }) =>
          new Bot<E, R>(
            client,
            loginLatch,
            loginSemaphore,
            chatInputCommandsMap,
            buttonsMap,
            Layer.empty,
            layer,
            scopeLayer,
          ),
      ),
      Effect.tap(({ client }) =>
        client.once(Events.ClientReady, (client) =>
          Effect.runPromise(
            pipe(
              Effect.tryPromise(() => client.application.fetch()),
              Effect.tap(() => Effect.log("Bot is ready")),
            ),
          ),
        ),
      ),
      Effect.tap(({ bot, client }) =>
        client.on(Events.InteractionCreate, (interaction) =>
          Effect.runPromise(
            pipe(
              Bot.onInteraction(interaction)(bot),
              Effect.provide(bot.traceProvider),
            ),
          ),
        ),
      ),
      Effect.map(({ bot }) => bot),
    );
  }

  static withTraceProvider(traceProvider: Layer.Layer<never>) {
    return <E = never, R = never>(bot: Bot<E, R>) =>
      new Bot<E, R>(
        bot.client,
        bot.loginLatch,
        bot.loginSemaphore,
        bot.chatInputCommandsMap,
        bot.buttonsMap,
        traceProvider,
        bot.layer,
        bot.scopeLayer,
      );
  }

  static login<E = never, R = never>(bot: Bot<E, R>) {
    return Config.use(({ discordToken }) =>
      pipe(
        ScopeLayer.make(bot.layer),
        Effect.andThen((scopeLayer) =>
          SynchronizedRef.update(bot.scopeLayer, () => Option.some(scopeLayer)),
        ),
        Effect.andThen(() =>
          Effect.promise(() => bot.client.login(discordToken)),
        ),
        Effect.andThen(() => bot.loginLatch.await),
        Effect.as(bot),
        bot.loginSemaphore.withPermits(1),
      ),
    );
  }

  static destroy<E = never, R = never>(bot: Bot<E, R>) {
    return pipe(
      Effect.promise(() => bot.client.destroy()),
      Effect.andThen(() =>
        SynchronizedRef.updateEffect(bot.scopeLayer, (scopeLayer) =>
          pipe(
            scopeLayer,
            Option.match({
              onSome: (scopeLayer) => ScopeLayer.close(scopeLayer),
              onNone: () => Effect.void,
            }),
            Effect.as(Option.none()),
          ),
        ),
      ),
      Effect.tap(() => Effect.log("Bot is destroyed")),
      Effect.andThen(() => bot.loginLatch.release),
      Effect.as(bot),
    );
  }

  static addChatInputCommand<E = never, R = never>(
    command: AnyChatInputCommandHandlerContext<E, R>,
  ) {
    return <BE = never, BR = never>(bot: Bot<BE, BR>) =>
      pipe(
        Effect.Do,
        Effect.let("bot", () => bot as Bot<E | BE, R | BR>),
        Effect.tap(({ bot }) =>
          SynchronizedRef.update(bot.chatInputCommandsMap, (commandsMap) =>
            ChatInputCommandHandlerMap.add(command)(commandsMap),
          ),
        ),
        Effect.map(({ bot }) => bot),
      );
  }

  static addChatInputCommandHandlerMap<E = never, R = never>(
    commands: ChatInputCommandHandlerMap<E, R>,
  ) {
    return <BE = never, BR = never>(bot: Bot<BE, BR>) =>
      pipe(
        Effect.Do,
        Effect.let("bot", () => bot as Bot<E | BE, R | BR>),
        Effect.tap(({ bot }) =>
          SynchronizedRef.update(bot.chatInputCommandsMap, (commandsMap) =>
            ChatInputCommandHandlerMap.union(commands)(commandsMap),
          ),
        ),
        Effect.map(({ bot }) => bot),
      );
  }

  static addButton<E = never, R = never>(
    button: AnyButtonInteractionHandlerContext<E, R>,
  ) {
    return <BE = never, BR = never>(bot: Bot<BE, BR>) =>
      pipe(
        Effect.Do,
        Effect.let("bot", () => bot as Bot<E | BE, R | BR>),
        Effect.tap(({ bot }) =>
          SynchronizedRef.update(bot.buttonsMap, (buttonsMap) =>
            ButtonInteractionHandlerMap.add(button)(buttonsMap),
          ),
        ),
        Effect.map(({ bot }) => bot),
      );
  }

  static addButtonInteractionHandlerMap<E = never, R = never>(
    buttons: ButtonInteractionHandlerMap<E, R>,
  ) {
    return <BE = never, BR = never>(bot: Bot<BE, BR>) =>
      pipe(
        Effect.Do,
        Effect.let("bot", () => bot as Bot<E | BE, R | BR>),
        Effect.tap(({ bot }) =>
          SynchronizedRef.update(bot.buttonsMap, (buttonsMap) =>
            ButtonInteractionHandlerMap.union(buttons)(buttonsMap),
          ),
        ),
        Effect.map(({ bot }) => bot),
      );
  }

  static registerProcessHandlers<E = never, R = never>(bot: Bot<E, R>) {
    return pipe(
      Effect.sync(() => {
        process.on("SIGINT", () =>
          Effect.runPromise(
            pipe(
              Effect.log("SIGINT received, shutting down..."),
              Effect.andThen(() => Bot.destroy(bot)),
            ),
          ),
        );
        process.on("SIGTERM", () =>
          Effect.runPromise(
            pipe(
              Effect.log("SIGTERM received, shutting down..."),
              Effect.andThen(() => Bot.destroy(bot)),
            ),
          ),
        );
      }),
      Effect.as(bot),
    );
  }
}
