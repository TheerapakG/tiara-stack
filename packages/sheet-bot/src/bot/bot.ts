import { Config } from "@/config";
import {
  ButtonInteractionT,
  ChatInputCommandInteractionT,
  ClientService,
  InteractionServices,
  interactionServices,
  UserSelectMenuInteractionT,
} from "@/services";
import {
  ButtonHandlerVariantT,
  ChatInputHandlerVariantT,
  HandlerVariantHandlerContext,
  HandlerVariantMap,
  InteractionHandlerMapWithMetricsGroup,
  UserSelectMenuHandlerVariantT,
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
  InteractionType,
  MessageComponentInteraction,
  UserSelectMenuInteraction,
} from "discord.js";
import {
  Cause,
  Data,
  Effect,
  HashMap,
  Layer,
  Match,
  pipe,
  Runtime,
  SynchronizedRef,
} from "effect";
import { RunState } from "typhoon-core/runtime";

export class Bot<A = never, E = never, R = never> extends Data.TaggedClass(
  "Bot",
)<{
  readonly client: Client;
  readonly interactionHandlerMapWithMetricsGroup: SynchronizedRef.SynchronizedRef<
    InteractionHandlerMapWithMetricsGroup<A, E, R>
  >;
  readonly traceProvider: Layer.Layer<never>;
  readonly runState: RunState.RunState<void, Cause.UnknownException>;
}> {
  static onChatInputCommandInteraction = (
    interaction: ChatInputCommandInteraction,
  ) => {
    return <A = never, E = never, R = never>(
      bot: Bot<A, E, R>,
      runtime: Runtime.Runtime<R>,
    ) =>
      pipe(
        Effect.Do,
        Effect.bind("interactionHandlerMapWithMetricsGroup", () =>
          SynchronizedRef.get(bot.interactionHandlerMapWithMetricsGroup),
        ),
        Effect.flatMap(({ interactionHandlerMapWithMetricsGroup }) =>
          pipe(
            interactionHandlerMapWithMetricsGroup,
            InteractionHandlerMapWithMetricsGroup.chatInputCommandsExecuteAndReplyError(
              interaction.commandName,
            ),
            Effect.provide(
              interactionServices<ChatInputCommandInteractionT>(interaction),
            ),
            Effect.provide(runtime),
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
    return <A = never, E = never, R = never>(
      bot: Bot<A, E, R>,
      runtime: Runtime.Runtime<R>,
    ) =>
      pipe(
        Match.value(interaction),
        Match.when({ commandType: ApplicationCommandType.ChatInput }, () =>
          Bot.onChatInputCommandInteraction(
            interaction as ChatInputCommandInteraction,
          )(bot, runtime),
        ),
        Match.orElse(() => Effect.void),
      );
  };

  static onButtonInteraction = (interaction: ButtonInteraction) => {
    return <A = never, E = never, R = never>(
      bot: Bot<A, E, R>,
      runtime: Runtime.Runtime<R>,
    ) =>
      pipe(
        Effect.Do,
        Effect.bind("interactionHandlerMapWithMetricsGroup", () =>
          SynchronizedRef.get(bot.interactionHandlerMapWithMetricsGroup),
        ),
        Effect.flatMap(({ interactionHandlerMapWithMetricsGroup }) =>
          pipe(
            interactionHandlerMapWithMetricsGroup,
            InteractionHandlerMapWithMetricsGroup.buttonsExecuteAndReplyError(
              interaction.customId,
            ),
            Effect.provide(
              interactionServices<ButtonInteractionT>(interaction),
            ),
            Effect.provide(runtime),
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
    return <A = never, E = never, R = never>(
      bot: Bot<A, E, R>,
      runtime: Runtime.Runtime<R>,
    ) =>
      pipe(
        Effect.Do,
        Effect.bind("interactionHandlerMapWithMetricsGroup", () =>
          SynchronizedRef.get(bot.interactionHandlerMapWithMetricsGroup),
        ),
        Effect.flatMap(({ interactionHandlerMapWithMetricsGroup }) =>
          pipe(
            interactionHandlerMapWithMetricsGroup,
            InteractionHandlerMapWithMetricsGroup.userSelectMenuExecuteAndReplyError(
              interaction.customId,
            ),
            Effect.provide(
              interactionServices<UserSelectMenuInteractionT>(interaction),
            ),
            Effect.provide(runtime),
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
    return <A = never, E = never, R = never>(
      bot: Bot<A, E, R>,
      runtime: Runtime.Runtime<R>,
    ) =>
      pipe(
        Match.value(interaction),
        Match.when({ componentType: ComponentType.Button }, () =>
          Bot.onButtonInteraction(interaction as ButtonInteraction)(
            bot,
            runtime,
          ),
        ),
        Match.when({ componentType: ComponentType.UserSelect }, () =>
          Bot.onUserSelectMenuInteraction(
            interaction as UserSelectMenuInteraction,
          )(bot, runtime),
        ),
        Match.orElse(() => Effect.void),
      );
  };

  static onInteraction = (interaction: Interaction) => {
    return <A = never, E = never, R = never>(
      bot: Bot<A, E, R>,
      runtime: Runtime.Runtime<R>,
    ) =>
      pipe(
        Match.value(interaction),
        Match.when({ type: InteractionType.ApplicationCommand }, () =>
          Bot.onCommandInteraction(interaction as CommandInteraction)(
            bot,
            runtime,
          ),
        ),
        Match.when({ type: InteractionType.MessageComponent }, () =>
          Bot.onMessageComponentInteraction(
            interaction as MessageComponentInteraction,
          )(bot, runtime),
        ),
        Match.orElse(() => Effect.void),
      );
  };

  static create = <A = never, E = never, R = never>() => {
    return pipe(
      Effect.Do,
      bindObject({
        client: Effect.succeed(
          new Client({
            intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
          }),
        ),
        interactionHandlerMapWithMetricsGroup: SynchronizedRef.make(
          InteractionHandlerMapWithMetricsGroup.empty<A, E, R>(),
        ),
        traceProvider: Effect.succeed(Layer.empty),
        runState: RunState.make<void, Cause.UnknownException>(),
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

  static start = <A = never, E = never, R = never>(
    bot: Bot<A, E, R>,
    runtime: Runtime.Runtime<R>,
  ) => {
    return Config.use(({ discordToken }) =>
      pipe(
        bot.runState,
        RunState.start(
          pipe(
            Effect.try(() =>
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
                      Effect.tap(() =>
                        pipe(
                          bot.interactionHandlerMapWithMetricsGroup,
                          SynchronizedRef.get,
                          Effect.flatMap(
                            InteractionHandlerMapWithMetricsGroup.initialize,
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
                      Bot.onInteraction(interaction)(bot, runtime),
                      Effect.provide(bot.traceProvider),
                      Effect.catchAll(() => Effect.void),
                    ),
                  ),
                ),
            ),
            Effect.andThen(() =>
              Effect.promise(() => bot.client.login(discordToken)),
            ),
            Effect.andThen(() => Effect.makeLatch()),
            Effect.andThen((latch) => latch.await),
          ),
          runtime,
        ),
        Effect.as(bot),
      ),
    );
  };

  static stop = <A = never, E = never, R = never>(bot: Bot<A, E, R>) => {
    return pipe(
      Effect.promise(() => bot.client.destroy()),
      Effect.andThen(RunState.stop(bot.runState)),
      Effect.tap(() => Effect.log("Bot is destroyed")),
      Effect.as(bot),
    );
  };

  static addChatInputCommand = <A = never, E = never, R = never>(
    command: HandlerVariantHandlerContext<ChatInputHandlerVariantT, A, E, R>,
  ) => {
    return <BA = never, BE = never, BR = never>(bot: Bot<BA, BE, BR>) =>
      pipe(
        Effect.Do,
        Effect.let(
          "bot",
          () =>
            bot as Bot<
              A | BA,
              E | BE,
              Exclude<R, InteractionServices<ChatInputCommandInteractionT>> | BR
            >,
        ),
        Effect.tap(({ bot }) =>
          SynchronizedRef.update(
            bot.interactionHandlerMapWithMetricsGroup,
            InteractionHandlerMapWithMetricsGroup.addChatInputCommand(
              command as HandlerVariantHandlerContext<
                ChatInputHandlerVariantT,
                A,
                E,
                Exclude<R, InteractionServices<ChatInputCommandInteractionT>>
              >,
            ),
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
        Effect.let(
          "bot",
          () =>
            bot as Bot<
              A | BA,
              E | BE,
              Exclude<R, InteractionServices<ChatInputCommandInteractionT>> | BR
            >,
        ),
        Effect.tap(({ bot }) =>
          SynchronizedRef.update(
            bot.interactionHandlerMapWithMetricsGroup,
            InteractionHandlerMapWithMetricsGroup.addChatInputCommandHandlerMap(
              commands as HandlerVariantMap<
                ChatInputHandlerVariantT,
                A,
                E,
                Exclude<R, InteractionServices<ChatInputCommandInteractionT>>
              >,
            ),
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
        Effect.let(
          "bot",
          () =>
            bot as Bot<
              A | BA,
              E | BE,
              Exclude<R, InteractionServices<ButtonInteractionT>> | BR
            >,
        ),
        Effect.tap(({ bot }) =>
          SynchronizedRef.update(
            bot.interactionHandlerMapWithMetricsGroup,
            InteractionHandlerMapWithMetricsGroup.addButton(
              button as HandlerVariantHandlerContext<
                ButtonHandlerVariantT,
                A,
                E,
                Exclude<R, InteractionServices<ButtonInteractionT>>
              >,
            ),
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
        Effect.let(
          "bot",
          () =>
            bot as Bot<
              A | BA,
              E | BE,
              Exclude<R, InteractionServices<ButtonInteractionT>> | BR
            >,
        ),
        Effect.tap(({ bot }) =>
          SynchronizedRef.update(
            bot.interactionHandlerMapWithMetricsGroup,
            InteractionHandlerMapWithMetricsGroup.addButtonInteractionHandlerMap(
              buttons as HandlerVariantMap<
                ButtonHandlerVariantT,
                A,
                E,
                Exclude<R, InteractionServices<ButtonInteractionT>>
              >,
            ),
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
        Effect.let(
          "bot",
          () =>
            bot as Bot<
              A | BA,
              E | BE,
              Exclude<R, InteractionServices<UserSelectMenuInteractionT>> | BR
            >,
        ),
        Effect.tap(({ bot }) =>
          SynchronizedRef.update(
            bot.interactionHandlerMapWithMetricsGroup,
            InteractionHandlerMapWithMetricsGroup.addUserSelectMenu(
              userSelectMenu as HandlerVariantHandlerContext<
                UserSelectMenuHandlerVariantT,
                A,
                E,
                Exclude<R, InteractionServices<UserSelectMenuInteractionT>>
              >,
            ),
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
        Effect.let(
          "bot",
          () =>
            bot as Bot<
              A | BA,
              E | BE,
              Exclude<R, InteractionServices<UserSelectMenuInteractionT>> | BR
            >,
        ),
        Effect.tap(({ bot }) =>
          SynchronizedRef.update(
            bot.interactionHandlerMapWithMetricsGroup,
            InteractionHandlerMapWithMetricsGroup.addUserSelectMenuInteractionHandlerMap(
              userSelectMenus as HandlerVariantMap<
                UserSelectMenuHandlerVariantT,
                A,
                E,
                Exclude<R, InteractionServices<UserSelectMenuInteractionT>>
              >,
            ),
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
              Effect.andThen(() => Bot.stop(bot)),
            ),
          ),
        );
        process.on("SIGTERM", () =>
          Effect.runPromise(
            pipe(
              Effect.log("SIGTERM received, shutting down..."),
              Effect.andThen(() => Bot.stop(bot)),
            ),
          ),
        );
      }),
      Effect.as(bot),
    );
  };
}
