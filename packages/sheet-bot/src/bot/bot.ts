import { Config } from "@/config";
import {
  ButtonInteractionT,
  ChatInputCommandInteractionT,
  ClientService,
  InteractionContext,
  interactionServices,
  UserSelectMenuInteractionT,
} from "@/services";
import {
  ButtonHandlerVariantT,
  buttonInteractionHandlerMap,
  ChatInputHandlerVariantT,
  chatInputInteractionHandlerMap,
  HandlerVariantHandlerContext,
  HandlerVariantMap,
  InteractionHandlerMapWithMetrics,
  UserSelectMenuHandlerVariantT,
  userSelectMenuInteractionHandlerMap,
} from "@/types";
import { bindObject } from "@/utils";
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
  InteractionButtonComponentData,
  InteractionType,
  MessageComponentInteraction,
  SharedSlashCommand,
  SlashCommandSubcommandsOnlyBuilder,
  UserSelectMenuComponentData,
  UserSelectMenuInteraction,
} from "discord.js";
import {
  Data,
  Effect,
  HashMap,
  Layer,
  ManagedRuntime,
  Match,
  Option,
  pipe,
  SynchronizedRef,
} from "effect";

export class Bot<A = never, E = never, R = never> extends Data.TaggedClass(
  "Bot",
)<{
  readonly client: Client;
  readonly loginLatch: Effect.Latch;
  readonly loginSemaphore: Effect.Semaphore;
  readonly chatInputCommandsMap: SynchronizedRef.SynchronizedRef<
    InteractionHandlerMapWithMetrics<
      SharedSlashCommand | SlashCommandSubcommandsOnlyBuilder,
      A,
      E,
      R | InteractionContext<ChatInputCommandInteractionT>
    >
  >;
  readonly buttonsMap: SynchronizedRef.SynchronizedRef<
    InteractionHandlerMapWithMetrics<
      InteractionButtonComponentData,
      A,
      E,
      R | InteractionContext<ButtonInteractionT>
    >
  >;
  readonly userSelectMenuMap: SynchronizedRef.SynchronizedRef<
    InteractionHandlerMapWithMetrics<
      UserSelectMenuComponentData,
      A,
      E,
      R | InteractionContext<UserSelectMenuInteractionT>
    >
  >;
  readonly traceProvider: Layer.Layer<never>;
  readonly layer: Layer.Layer<R, E>;
  readonly runtime: SynchronizedRef.SynchronizedRef<
    Option.Option<ManagedRuntime.ManagedRuntime<R, E>>
  >;
}> {
  static onChatInputCommandInteraction = (
    interaction: ChatInputCommandInteraction,
  ) => {
    return <A = never, E = never, R = never>(bot: Bot<A, E, R>) =>
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
                chatInputCommandsMap,
                InteractionHandlerMapWithMetrics.executeAndReplyError(
                  interaction.commandName,
                ),
                Effect.provide(
                  interactionServices<ChatInputCommandInteractionT>(
                    interaction,
                  ),
                ),
                Effect.provide(runtime),
              ),
            ),
            Option.getOrElse(() => Effect.void),
          ),
        ),
        Effect.withSpan("Bot.onChatInputCommandInteraction", {
          captureStackTrace: true,
          attributes: {
            commandName: interaction.commandName,
            subcommandGroup: interaction.options.getSubcommandGroup(false),
            subcommand: interaction.options.getSubcommand(false),
            commandId: interaction.commandId,
          },
        }),
      );
  };

  static onCommandInteraction = (interaction: CommandInteraction) => {
    return <A = never, E = never, R = never>(bot: Bot<A, E, R>) =>
      pipe(
        Match.value(interaction),
        Match.when({ commandType: ApplicationCommandType.ChatInput }, () =>
          Bot.onChatInputCommandInteraction(
            interaction as ChatInputCommandInteraction,
          )(bot),
        ),
        Match.orElse(() => Effect.void),
      );
  };

  static onButtonInteraction = (interaction: ButtonInteraction) => {
    return <A = never, E = never, R = never>(bot: Bot<A, E, R>) =>
      pipe(
        Effect.Do,
        Effect.bind("runtime", () => SynchronizedRef.get(bot.runtime)),
        Effect.bind("buttonsMap", () => SynchronizedRef.get(bot.buttonsMap)),
        Effect.flatMap(({ runtime, buttonsMap }) =>
          pipe(
            runtime,
            Option.map((runtime) =>
              pipe(
                buttonsMap,
                InteractionHandlerMapWithMetrics.executeAndReplyError(
                  interaction.customId,
                ),
                Effect.provide(
                  interactionServices<ButtonInteractionT>(interaction),
                ),
                Effect.provide(runtime),
              ),
            ),
            Option.getOrElse(() => Effect.void),
          ),
        ),
        Effect.withSpan("Bot.onButtonInteraction", {
          captureStackTrace: true,
          attributes: {
            guildId: interaction.guildId,
          },
        }),
      );
  };

  static onUserSelectMenuInteraction = (
    interaction: UserSelectMenuInteraction,
  ) => {
    return <A = never, E = never, R = never>(bot: Bot<A, E, R>) =>
      pipe(
        Effect.Do,
        Effect.bind("runtime", () => SynchronizedRef.get(bot.runtime)),
        Effect.bind("userSelectMenuMap", () =>
          SynchronizedRef.get(bot.userSelectMenuMap),
        ),
        Effect.flatMap(({ runtime, userSelectMenuMap }) =>
          pipe(
            runtime,
            Option.map((runtime) =>
              pipe(
                userSelectMenuMap,
                InteractionHandlerMapWithMetrics.executeAndReplyError(
                  interaction.customId,
                ),
                Effect.provide(
                  interactionServices<UserSelectMenuInteractionT>(interaction),
                ),
                Effect.provide(runtime),
              ),
            ),
            Option.getOrElse(() => Effect.void),
          ),
        ),
        Effect.withSpan("Bot.onUserSelectMenuInteraction", {
          captureStackTrace: true,
          attributes: {
            guildId: interaction.guildId,
          },
        }),
      );
  };

  static onMessageComponentInteraction = (
    interaction: MessageComponentInteraction,
  ) => {
    return <A = never, E = never, R = never>(bot: Bot<A, E, R>) =>
      pipe(
        Match.value(interaction),
        Match.when({ componentType: ComponentType.Button }, () =>
          Bot.onButtonInteraction(interaction as ButtonInteraction)(bot),
        ),
        Match.when({ componentType: ComponentType.UserSelect }, () =>
          Bot.onUserSelectMenuInteraction(
            interaction as UserSelectMenuInteraction,
          )(bot),
        ),
        Match.orElse(() => Effect.void),
      );
  };

  static onInteraction = (interaction: Interaction) => {
    return <A = never, E = never, R = never>(bot: Bot<A, E, R>) =>
      pipe(
        Match.value(interaction),
        Match.when({ type: InteractionType.ApplicationCommand }, () =>
          Bot.onCommandInteraction(interaction as CommandInteraction)(bot),
        ),
        Match.when({ type: InteractionType.MessageComponent }, () =>
          Bot.onMessageComponentInteraction(
            interaction as MessageComponentInteraction,
          )(bot),
        ),
        Match.orElse(() => Effect.void),
      );
  };

  static create = <A = never, E = never, R = never>(
    layer: Layer.Layer<R, E>,
  ) => {
    return pipe(
      Effect.Do,
      bindObject({
        client: Effect.succeed(
          new Client({
            intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
          }),
        ),
        loginLatch: Effect.makeLatch(false),
        loginSemaphore: Effect.makeSemaphore(1),
        chatInputCommandsMap: SynchronizedRef.make(
          InteractionHandlerMapWithMetrics.make(
            "chat_input_command",
            chatInputInteractionHandlerMap<A, E, R>(),
          ),
        ),
        buttonsMap: SynchronizedRef.make(
          InteractionHandlerMapWithMetrics.make(
            "button",
            buttonInteractionHandlerMap<A, E, R>(),
          ),
        ),
        userSelectMenuMap: SynchronizedRef.make(
          InteractionHandlerMapWithMetrics.make(
            "user_select_menu",
            userSelectMenuInteractionHandlerMap<A, E, R>(),
          ),
        ),
        traceProvider: Effect.succeed(Layer.empty),
        layer: Effect.succeed(layer),
        runtime: SynchronizedRef.make(
          Option.none<ManagedRuntime.ManagedRuntime<R, E>>(),
        ),
      }),
      Effect.map((params) => new Bot<A, E, R>(params)),
    );
  };

  static withTraceProvider = (traceProvider: Layer.Layer<never>) => {
    return <A = never, E = never, R = never>(bot: Bot<A, E, R>) =>
      new Bot<A, E, R>({
        ...bot,
        traceProvider,
      });
  };

  static login = <A = never, E = never, R = never>(bot: Bot<A, E, R>) => {
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
                  ClientService.fetchApplication(),
                  Effect.tap(() => ClientService.fetchGuilds()),
                  Effect.andThen(() => ClientService.getGuilds()),
                  Effect.tap((guilds) =>
                    Effect.forEach(HashMap.values(guilds), (guild) =>
                      Effect.log(
                        `guildId: ${guild.id} guildName: ${guild.name}`,
                      ),
                    ),
                  ),
                  Effect.tap(() => Effect.log("Bot is ready")),
                  Effect.provide(ClientService.Default(client)),
                ),
              ),
            )
            .on(Events.InteractionCreate, (interaction) =>
              Effect.runPromise(
                pipe(
                  bot,
                  Bot.onInteraction(interaction),
                  Effect.provide(bot.traceProvider),
                  Effect.catchAll(() => Effect.void),
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
  };

  static destroy = <A = never, E = never, R = never>(bot: Bot<A, E, R>) => {
    return pipe(
      Effect.promise(() => bot.client.destroy()),
      Effect.andThen(() =>
        SynchronizedRef.updateEffect(bot.runtime, (runtime) =>
          pipe(
            runtime,
            Effect.transposeMapOption((runtime) =>
              Effect.tryPromise(() => runtime.dispose()),
            ),
            Effect.as(Option.none()),
          ),
        ),
      ),
      Effect.tap(() => Effect.log("Bot is destroyed")),
      Effect.andThen(() => bot.loginLatch.release),
      Effect.as(bot),
    );
  };

  static addChatInputCommand = <A = never, E = never, R = never>(
    command: HandlerVariantHandlerContext<ChatInputHandlerVariantT, A, E, R>,
  ) => {
    return <BA = never, BE = never, BR = never>(bot: Bot<BA, BE, BR>) =>
      pipe(
        Effect.Do,
        Effect.let("bot", () => bot as Bot<A | BA, E | BE, R | BR>),
        Effect.tap(({ bot }) =>
          SynchronizedRef.update(
            bot.chatInputCommandsMap,
            InteractionHandlerMapWithMetrics.add(command),
          ),
        ),
        Effect.map(({ bot }) => bot),
      );
  };

  static addChatInputCommandHandlerMap = <A = never, E = never, R = never>(
    commands: HandlerVariantMap<ChatInputHandlerVariantT, A, E, R>,
  ) => {
    return <BA = never, BE = never, BR = never>(bot: Bot<BA, BE, BR>) =>
      pipe(
        Effect.Do,
        Effect.let("bot", () => bot as Bot<A | BA, E | BE, R | BR>),
        Effect.tap(({ bot }) =>
          SynchronizedRef.update(
            bot.chatInputCommandsMap,
            InteractionHandlerMapWithMetrics.union(commands),
          ),
        ),
        Effect.map(({ bot }) => bot),
      );
  };

  static addButton = <A = never, E = never, R = never>(
    button: HandlerVariantHandlerContext<ButtonHandlerVariantT, A, E, R>,
  ) => {
    return <BA = never, BE = never, BR = never>(bot: Bot<BA, BE, BR>) =>
      pipe(
        Effect.Do,
        Effect.let("bot", () => bot as Bot<A | BA, E | BE, R | BR>),
        Effect.tap(({ bot }) =>
          SynchronizedRef.update(
            bot.buttonsMap,
            InteractionHandlerMapWithMetrics.add(button),
          ),
        ),
        Effect.map(({ bot }) => bot),
      );
  };

  static addButtonInteractionHandlerMap = <A = never, E = never, R = never>(
    buttons: HandlerVariantMap<ButtonHandlerVariantT, A, E, R>,
  ) => {
    return <BA = never, BE = never, BR = never>(bot: Bot<BA, BE, BR>) =>
      pipe(
        Effect.Do,
        Effect.let("bot", () => bot as Bot<A | BA, E | BE, R | BR>),
        Effect.tap(({ bot }) =>
          SynchronizedRef.update(
            bot.buttonsMap,
            InteractionHandlerMapWithMetrics.union(buttons),
          ),
        ),
        Effect.map(({ bot }) => bot),
      );
  };

  static addUserSelectMenu = <A = never, E = never, R = never>(
    userSelectMenu: HandlerVariantHandlerContext<
      UserSelectMenuHandlerVariantT,
      A,
      E,
      R
    >,
  ) => {
    return <BA = never, BE = never, BR = never>(bot: Bot<BA, BE, BR>) =>
      pipe(
        Effect.Do,
        Effect.let("bot", () => bot as Bot<A | BA, E | BE, R | BR>),
        Effect.tap(({ bot }) =>
          SynchronizedRef.update(
            bot.userSelectMenuMap,
            InteractionHandlerMapWithMetrics.add(userSelectMenu),
          ),
        ),
        Effect.map(({ bot }) => bot),
      );
  };

  static addUserSelectMenuInteractionHandlerMap = <
    A = never,
    E = never,
    R = never,
  >(
    userSelectMenus: HandlerVariantMap<UserSelectMenuHandlerVariantT, A, E, R>,
  ) => {
    return <BA = never, BE = never, BR = never>(bot: Bot<BA, BE, BR>) =>
      pipe(
        Effect.Do,
        Effect.let("bot", () => bot as Bot<A | BA, E | BE, R | BR>),
        Effect.tap(({ bot }) =>
          SynchronizedRef.update(
            bot.userSelectMenuMap,
            InteractionHandlerMapWithMetrics.union(userSelectMenus),
          ),
        ),
        Effect.map(({ bot }) => bot),
      );
  };

  static registerProcessHandlers = <A = never, E = never, R = never>(
    bot: Bot<A, E, R>,
  ) => {
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
  };
}
