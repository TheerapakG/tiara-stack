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
  HashSet,
  Layer,
  Match,
  pipe,
  Runtime,
  SynchronizedRef,
  Scope,
} from "effect";
import { RunState } from "typhoon-core/runtime";

interface BotRunStateContextTypeLambda
  extends RunState.RunStateContextTypeLambda {
  readonly type: Bot<any, any, this["R"]>;
}
export class Bot<A = never, E = never, R = never> extends Data.TaggedClass(
  "Bot",
)<{
  readonly client: Client;
  readonly interactionHandlerMapWithMetricsGroup: SynchronizedRef.SynchronizedRef<
    InteractionHandlerMapWithMetricsGroup<A, E, R | ClientService>
  >;
  readonly traceProvider: Layer.Layer<never>;
  readonly tasks: SynchronizedRef.SynchronizedRef<
    HashSet.HashSet<Effect.Effect<unknown, unknown, R | ClientService>>
  >;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly runState: RunState.RunState<
    BotRunStateContextTypeLambda,
    void,
    Cause.UnknownException
  >;
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

  static makeStartEffect =
    <A = never, E = never>(discordToken: string) =>
    <R = never>(bot: Bot<A, E, R>, runtime: Runtime.Runtime<R>) =>
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
                  Effect.andThen(
                    pipe(
                      bot.tasks,
                      SynchronizedRef.get,
                      Effect.tap((tasks) =>
                        Effect.forEach(HashSet.toValues(tasks), (task) =>
                          Effect.sync(() =>
                            Runtime.runFork(
                              runtime,
                              pipe(
                                task,
                                Effect.provide(bot.traceProvider),
                                Effect.provide(ClientService.Default(client)),
                                Effect.catchAll((error) =>
                                  Effect.logError(error),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                      Effect.andThen((tasks) =>
                        Effect.log(`${HashSet.size(tasks)} tasks initialized`),
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
      );

  static makeFinalizer =
    <A = never, E = never, R = never>() =>
    (bot: Bot<A, E, R>) =>
      Effect.promise(() => bot.client.destroy());

  static create = <A = never, E = never, R = never>() =>
    Config.use(({ discordToken }) =>
      pipe(
        Effect.Do,
        bindObject({
          client: Effect.succeed(
            new Client({
              intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMembers,
              ],
            }),
          ),
          interactionHandlerMapWithMetricsGroup: SynchronizedRef.make(
            InteractionHandlerMapWithMetricsGroup.empty<
              A,
              E,
              R | ClientService
            >(),
          ),
          tasks: SynchronizedRef.make(
            HashSet.empty<Effect.Effect<unknown, unknown, R | ClientService>>(),
          ),
          traceProvider: Effect.succeed(Layer.empty),
          runState: RunState.make(
            Bot.makeStartEffect<A, E>(discordToken),
            Bot.makeFinalizer<A, E, R>(),
          ),
        }),
        Effect.map((params) => new Bot<A, E, R>(params)),
      ),
    );

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
  ) => pipe(bot.runState, RunState.start(bot, runtime), Effect.as(bot));

  static stop = <A = never, E = never, R = never>(
    bot: Bot<A, E, R>,
    runtime: Runtime.Runtime<R>,
  ) => {
    return pipe(
      bot.runState,
      RunState.stop(bot, runtime),
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
              | Exclude<
                  R,
                  | InteractionServices<ChatInputCommandInteractionT>
                  | ClientService
                  | Scope.Scope
                >
              | BR
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
                Exclude<
                  R,
                  | InteractionServices<ChatInputCommandInteractionT>
                  | ClientService
                  | Scope.Scope
                >
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
              | Exclude<
                  R,
                  | InteractionServices<ChatInputCommandInteractionT>
                  | ClientService
                  | Scope.Scope
                >
              | BR
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
                Exclude<
                  R,
                  | InteractionServices<ChatInputCommandInteractionT>
                  | ClientService
                  | Scope.Scope
                >
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
              | Exclude<
                  R,
                  | InteractionServices<ButtonInteractionT>
                  | ClientService
                  | Scope.Scope
                >
              | BR
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
                Exclude<
                  R,
                  | InteractionServices<ButtonInteractionT>
                  | ClientService
                  | Scope.Scope
                >
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
              | Exclude<
                  R,
                  | InteractionServices<ButtonInteractionT>
                  | ClientService
                  | Scope.Scope
                >
              | BR
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
                Exclude<
                  R,
                  | InteractionServices<ButtonInteractionT>
                  | ClientService
                  | Scope.Scope
                >
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
              | Exclude<
                  R,
                  | InteractionServices<UserSelectMenuInteractionT>
                  | ClientService
                  | Scope.Scope
                >
              | BR
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
                Exclude<
                  R,
                  | InteractionServices<UserSelectMenuInteractionT>
                  | ClientService
                  | Scope.Scope
                >
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
              | Exclude<
                  R,
                  | InteractionServices<UserSelectMenuInteractionT>
                  | ClientService
                  | Scope.Scope
                >
              | BR
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
                Exclude<
                  R,
                  | InteractionServices<UserSelectMenuInteractionT>
                  | ClientService
                  | Scope.Scope
                >
              >,
            ),
          ),
        ),
        Effect.map(({ bot }) => bot),
      );
  };

  static addTask = <R = never>(task: Effect.Effect<unknown, unknown, R>) => {
    return <BA = never, BE = never, BR = never>(bot: Bot<BA, BE, BR>) =>
      pipe(
        Effect.Do,
        Effect.let(
          "bot",
          () => bot as Bot<BA, BE, Exclude<R, ClientService> | BR>,
        ),
        Effect.tap(({ bot }) =>
          SynchronizedRef.update(bot.tasks, (tasks) =>
            HashSet.add(
              tasks as HashSet.HashSet<
                Effect.Effect<unknown, unknown, Exclude<R, ClientService> | BR>
              >,
              task as Effect.Effect<
                unknown,
                unknown,
                Exclude<R, ClientService> | BR
              >,
            ),
          ),
        ),
        Effect.map(({ bot }) => bot),
      );
  };

  static addTasks = <R = never>(
    tasks: Iterable<Effect.Effect<unknown, unknown, R>>,
  ) => {
    return <BA = never, BE = never, BR = never>(bot: Bot<BA, BE, BR>) =>
      pipe(
        Effect.Do,
        Effect.let(
          "bot",
          () => bot as Bot<BA, BE, Exclude<R, ClientService> | BR>,
        ),
        Effect.tap(({ bot }) =>
          SynchronizedRef.update(bot.tasks, (existing) =>
            HashSet.union(
              existing as HashSet.HashSet<
                Effect.Effect<unknown, unknown, Exclude<R, ClientService> | BR>
              >,
              HashSet.fromIterable(
                tasks as Iterable<
                  Effect.Effect<
                    unknown,
                    unknown,
                    Exclude<R, ClientService> | BR
                  >
                >,
              ),
            ),
          ),
        ),
        Effect.map(({ bot }) => bot),
      );
  };
}
