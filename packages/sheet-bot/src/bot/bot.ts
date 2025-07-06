import { Client, Events, GatewayIntentBits, MessageFlags } from "discord.js";
import {
  Cause,
  Effect,
  Exit,
  HashMap,
  Layer,
  Option,
  pipe,
  Scope,
  SynchronizedRef,
} from "effect";
import { Config } from "../config";
import { Command } from "../types";

class ScopeLayer<E = unknown, R = unknown> {
  constructor(
    private readonly scope: Scope.CloseableScope,
    private readonly layer: Layer.Layer<R, E>,
  ) {}

  static make<E = unknown, R = unknown>(layer: Layer.Layer<R, E>) {
    return pipe(
      Effect.Do,
      Effect.bind("scope", () => Scope.make()),
      Effect.bind("layer", ({ scope }) =>
        pipe(Layer.memoize(layer), Scope.extend(scope)),
      ),
      Effect.map(({ scope, layer }) => new ScopeLayer(scope, layer)),
    );
  }

  static provide<E = unknown, R = unknown>(scopeLayer: ScopeLayer<E, R>) {
    return Effect.provide(scopeLayer.layer);
  }

  static close<E = unknown, R = unknown>(scopeLayer: ScopeLayer<E, R>) {
    return Scope.close(scopeLayer.scope, Exit.void);
  }
}

export class Bot<E = unknown, R = unknown> {
  constructor(
    private readonly client: Client,
    private readonly loginLatch: Effect.Latch,
    private readonly loginSemaphore: Effect.Semaphore,
    private readonly commandsMap: SynchronizedRef.SynchronizedRef<
      HashMap.HashMap<string, Command<unknown, R>>
    >,
    private readonly layer: Layer.Layer<R, E>,
    private readonly scopeLayer: SynchronizedRef.SynchronizedRef<
      Option.Option<ScopeLayer<E, R>>
    >,
  ) {}

  static create<E = unknown, R = unknown>(layer: Layer.Layer<R, E>) {
    return pipe(
      Effect.Do,
      Effect.let(
        "client",
        () => new Client({ intents: [GatewayIntentBits.Guilds] }),
      ),
      Effect.bind("loginLatch", () => Effect.makeLatch(false)),
      Effect.bind("loginSemaphore", () => Effect.makeSemaphore(1)),
      Effect.bind("commandsMap", () =>
        SynchronizedRef.make(HashMap.empty<string, Command<unknown, R>>()),
      ),
      Effect.bind("scopeLayer", () =>
        SynchronizedRef.make(Option.none<ScopeLayer<E, R>>()),
      ),
      Effect.let(
        "bot",
        ({ client, loginLatch, loginSemaphore, commandsMap, scopeLayer }) =>
          new Bot(
            client,
            loginLatch,
            loginSemaphore,
            commandsMap,
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
            interaction.isChatInputCommand()
              ? pipe(
                  SynchronizedRef.get(bot.commandsMap),
                  Effect.map((commandsMap) =>
                    HashMap.get(commandsMap, interaction.commandName),
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
                                  command.execute(interaction),
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
                )
              : Effect.void,
          ),
        ),
      ),
      Effect.map(({ bot }) => bot),
    );
  }

  static login<E = unknown, R = unknown>(bot: Bot<E, R>) {
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

  static destroy<E = unknown, R = unknown>(bot: Bot<E, R>) {
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

  static addCommand<R = unknown>(command: Command<unknown, R>) {
    return <BE = unknown, BR = unknown>(bot: Bot<BE, R | BR>) =>
      pipe(
        SynchronizedRef.update(bot.commandsMap, (commandsMap) =>
          HashMap.set(commandsMap, command.data.name, command),
        ),
        Effect.as(bot),
      );
  }

  static registerProcessHandlers<E = unknown, R = unknown>(bot: Bot<E, R>) {
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
