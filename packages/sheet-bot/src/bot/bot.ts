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
  InteractionResponse,
  InteractionType,
  Message,
  MessageComponentInteraction,
  MessageFlags,
} from "discord.js";
import {
  Cause,
  Data,
  Effect,
  Exit,
  Layer,
  ManagedRuntime,
  Option,
  pipe,
  SynchronizedRef,
} from "effect";
import { Config } from "../config";
import {
  AnyButtonInteractionHandlerContext,
  AnyChatInputCommandHandlerContext,
  ButtonInteractionHandlerMap,
  ChatInputCommandHandlerMap,
  InteractionContext,
} from "../types";

export class Bot<E = never, R = never> extends Data.TaggedClass("Bot")<{
  readonly client: Client;
  readonly loginLatch: Effect.Latch;
  readonly loginSemaphore: Effect.Semaphore;
  readonly chatInputCommandsMap: SynchronizedRef.SynchronizedRef<
    ChatInputCommandHandlerMap<
      E,
      R | InteractionContext<ChatInputCommandInteraction>
    >
  >;
  readonly buttonsMap: SynchronizedRef.SynchronizedRef<
    ButtonInteractionHandlerMap<E, R | InteractionContext<ButtonInteraction>>
  >;
  readonly traceProvider: Layer.Layer<never>;
  readonly layer: Layer.Layer<R, E>;
  readonly runtime: SynchronizedRef.SynchronizedRef<
    Option.Option<ManagedRuntime.ManagedRuntime<R, E>>
  >;
}> {
  static onChatInputCommandInteraction(
    interaction: ChatInputCommandInteraction,
  ) {
    return <E = never, R = never>(bot: Bot<E, R>) =>
      pipe(
        Effect.Do,
        Effect.bind("runtime", () => SynchronizedRef.get(bot.runtime)),
        Effect.bind("chatInputCommandsMap", () =>
          SynchronizedRef.get(bot.chatInputCommandsMap),
        ),
        Effect.flatMap(({ runtime, chatInputCommandsMap }) =>
          pipe(
            runtime,
            Option.map((runtime) =>
              pipe(
                ChatInputCommandHandlerMap.get(interaction.commandName)(
                  chatInputCommandsMap,
                ),
                Option.map((command) => command.handler),
                Option.getOrElse(() => Effect.void),
                Effect.provide(runtime),
                Effect.provide(InteractionContext.make(interaction)),
              ),
            ),
            Option.getOrElse(() => Effect.void),
          ),
        ),
        Effect.exit,
        Effect.flatMap(
          Exit.match({
            onSuccess: Effect.succeed,
            onFailure: (cause) =>
              pipe(
                Effect.succeed(cause),
                Effect.tap((cause) => Effect.log(cause)),
                Effect.map(Cause.pretty),
                Effect.tap((pretty) =>
                  Effect.promise<Message | InteractionResponse>(() =>
                    (interaction.replied || interaction.deferred
                      ? interaction.followUp.bind(interaction)
                      : interaction.reply.bind(interaction))({
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
        Effect.withSpan("Bot.onChatInputCommandInteraction", {
          captureStackTrace: true,
        }),
        Effect.annotateSpans({
          commandName: interaction.commandName,
          subcommandGroup: interaction.options.getSubcommandGroup(false),
          subcommand: interaction.options.getSubcommand(false),
          commandId: interaction.commandId,
        }),
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
        Effect.Do,
        Effect.bind("runtime", () => SynchronizedRef.get(bot.runtime)),
        Effect.bind("buttonsMap", () => SynchronizedRef.get(bot.buttonsMap)),
        Effect.flatMap(({ runtime, buttonsMap }) =>
          pipe(
            runtime,
            Option.map((runtime) =>
              pipe(
                ButtonInteractionHandlerMap.get(interaction.customId)(
                  buttonsMap,
                ),
                Option.map((command) => command.handler),
                Option.getOrElse(() => Effect.void),
                Effect.provide(runtime),
                Effect.provide(InteractionContext.make(interaction)),
              ),
            ),
            Option.getOrElse(() => Effect.void),
          ),
        ),
        Effect.exit,
        Effect.flatMap(
          Exit.match({
            onSuccess: Effect.succeed,
            onFailure: (cause) =>
              pipe(
                Effect.succeed(cause),
                Effect.tap((cause) => Effect.log(cause)),
                Effect.map(Cause.pretty),
                Effect.tap((pretty) =>
                  Effect.promise<Message | InteractionResponse>(() =>
                    (interaction.replied || interaction.deferred
                      ? interaction.followUp.bind(interaction)
                      : interaction.reply.bind(interaction))({
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
        Effect.withSpan("Bot.onButtonInteraction", {
          captureStackTrace: true,
        }),
        Effect.annotateSpans({
          customId: interaction.customId,
        }),
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
      Effect.bindAll(
        () => ({
          client: Effect.succeed(
            new Client({ intents: [GatewayIntentBits.Guilds] }),
          ),
          loginLatch: Effect.makeLatch(false),
          loginSemaphore: Effect.makeSemaphore(1),
          chatInputCommandsMap: SynchronizedRef.make(
            ChatInputCommandHandlerMap.empty<
              E,
              R | InteractionContext<ChatInputCommandInteraction>
            >(),
          ),
          buttonsMap: SynchronizedRef.make(
            ButtonInteractionHandlerMap.empty<
              E,
              R | InteractionContext<ButtonInteraction>
            >(),
          ),
          traceProvider: Effect.succeed(Layer.empty),
          layer: Effect.succeed(layer),
          runtime: SynchronizedRef.make(
            Option.none<ManagedRuntime.ManagedRuntime<R, E>>(),
          ),
        }),
        { concurrency: "unbounded" },
      ),
      Effect.let("bot", (params) => new Bot<E, R>(params)),
      Effect.map(({ bot }) => bot),
    );
  }

  static withTraceProvider(traceProvider: Layer.Layer<never>) {
    return <E = never, R = never>(bot: Bot<E, R>) =>
      new Bot<E, R>({
        ...bot,
        traceProvider,
      });
  }

  static login<E = never, R = never>(bot: Bot<E, R>) {
    return Config.use(({ discordToken }) =>
      pipe(
        SynchronizedRef.update(bot.runtime, () =>
          Option.some(ManagedRuntime.make(bot.layer)),
        ),
        Effect.andThen(() =>
          bot.client
            .once(Events.ClientReady, (client) =>
              Effect.runPromise(
                pipe(
                  Effect.tryPromise(() => client.application.fetch()),
                  Effect.tap(() => Effect.log("Bot is ready")),
                ),
              ),
            )
            .on(Events.InteractionCreate, (interaction) =>
              Effect.runPromise(
                pipe(
                  Bot.onInteraction(interaction)(bot),
                  Effect.provide(bot.traceProvider),
                ),
              ),
            ),
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
        SynchronizedRef.updateEffect(bot.runtime, (runtime) =>
          pipe(
            runtime,
            Option.match({
              onSome: (runtime) => Effect.tryPromise(() => runtime.dispose()),
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
    command: AnyChatInputCommandHandlerContext<
      E,
      R | InteractionContext<ChatInputCommandInteraction>
    >,
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
    commands: ChatInputCommandHandlerMap<
      E,
      R | InteractionContext<ChatInputCommandInteraction>
    >,
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
    button: AnyButtonInteractionHandlerContext<
      E,
      R | InteractionContext<ButtonInteraction>
    >,
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
    buttons: ButtonInteractionHandlerMap<
      E,
      R | InteractionContext<ButtonInteraction>
    >,
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
