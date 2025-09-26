import {
  ButtonInteractionT,
  ChatInputCommandInteractionT,
  ClientService,
  InteractionContext,
  RepliableInteractionT,
  UserSelectMenuInteractionT,
} from "@/services";
import { DiscordError } from "@/types/error/discordError";
import {
  InteractionButtonComponentData,
  InteractionResponse,
  Message,
  MessageFlags,
  SharedSlashCommand,
  SlashCommandSubcommandsOnlyBuilder,
  UserSelectMenuComponentData,
} from "discord.js";
import {
  Cause,
  Data,
  Effect,
  HashMap,
  Metric,
  Option,
  pipe,
  Struct,
} from "effect";
import {
  InteractionHandler,
  InteractionHandlerContext,
  InteractionHandlerMap,
} from "./handler";
import {
  HandlerVariantHandlerContext,
  HandlerVariantMap,
} from "./handlerVariant";
import {
  ButtonHandlerVariantT,
  buttonInteractionHandlerMap,
  ChatInputHandlerVariantT,
  chatInputInteractionHandlerMap,
  UserSelectMenuHandlerVariantT,
  userSelectMenuInteractionHandlerMap,
} from "./variants";

type InteractionHandlerMapWithMetricsObject<
  Data = unknown,
  A = never,
  E = never,
  R = never,
> = {
  map: InteractionHandlerMap<Data, A, E, R>;
  interactionType: string;
  interactionCount: Metric.Metric.Counter<bigint>;
};

export class InteractionHandlerMapWithMetrics<
  Data = unknown,
  A = never,
  E = never,
  R = never,
> extends Data.TaggedClass("InteractionHandlerMapWithMetrics")<
  InteractionHandlerMapWithMetricsObject<Data, A, E, R>
> {
  static make = <Data = unknown, A = never, E = never, R = never>(
    interactionType: string,
    map: InteractionHandlerMap<Data, A, E, R>,
  ) =>
    new InteractionHandlerMapWithMetrics({
      map,
      interactionType,
      interactionCount: Metric.counter(
        `typhoon_discord_bot_interaction_total`,
        {
          description: `The number of interactions with the bot`,
          bigint: true,
          incremental: true,
        },
      ),
    });

  static add =
    <Data1 extends Data2, Data2, A1 = never, E1 = never, R1 = never>(
      context: InteractionHandlerContext<Data1, A1, E1, R1>,
    ) =>
    <A2 = never, E2 = never, R2 = never>(
      map: InteractionHandlerMapWithMetrics<Data2, A2, E2, R2>,
    ) =>
      new InteractionHandlerMapWithMetrics({
        map: pipe(map.map, InteractionHandlerMap.add(context)),
        interactionType: map.interactionType,
        interactionCount: map.interactionCount,
      });

  static union =
    <Data1 extends Data2, Data2, A1 = never, E1 = never, R1 = never>(
      map: InteractionHandlerMap<Data1, A1, E1, R1>,
    ) =>
    <A2 = never, E2 = never, R2 = never>(
      other: InteractionHandlerMapWithMetrics<Data2, A2, E2, R2>,
    ) =>
      new InteractionHandlerMapWithMetrics({
        map: pipe(other.map, InteractionHandlerMap.union(map)),
        interactionType: other.interactionType,
        interactionCount: other.interactionCount,
      });

  static execute =
    (interactionKey: string) =>
    <Data, A, E, R>(map: InteractionHandlerMapWithMetrics<Data, A, E, R>) =>
      pipe(
        map.map,
        InteractionHandlerMap.get(interactionKey),
        Option.map(
          (context) => context.handler as InteractionHandler<A | void, E, R>,
        ),
        Option.getOrElse(() => Effect.void as Effect.Effect<A | void, E, R>),
        Effect.tapBoth({
          onSuccess: () =>
            pipe(
              InteractionContext.guildId().sync(),
              Effect.flatMap((guildId) =>
                pipe(
                  map.interactionCount,
                  Metric.update(BigInt(1)),
                  Effect.tagMetrics({
                    interaction_type: map.interactionType,
                    interaction_key: interactionKey,
                    interaction_guild_id: pipe(
                      guildId,
                      Option.getOrElse(() => "unknown"),
                    ),
                    interaction_status: "success",
                  }),
                ),
              ),
            ),
          onFailure: () =>
            pipe(
              InteractionContext.guildId().sync(),
              Effect.flatMap((guildId) =>
                pipe(
                  map.interactionCount,
                  Metric.update(BigInt(1)),
                  Effect.tagMetrics({
                    interaction_type: map.interactionType,
                    interaction_key: interactionKey,
                    interaction_guild_id: pipe(
                      guildId,
                      Option.getOrElse(() => "unknown"),
                    ),
                    interaction_status: "failure",
                  }),
                ),
              ),
            ),
        }),
        Effect.withSpan("InteractionHandlerMapWithMetrics.execute", {
          captureStackTrace: true,
        }),
      );

  static executeAndReplyError =
    (interactionKey: string) =>
    <Data, A, E, R>(map: InteractionHandlerMapWithMetrics<Data, A, E, R>) =>
      pipe(
        map,
        InteractionHandlerMapWithMetrics.execute(interactionKey),
        Effect.sandbox,
        Effect.tapBoth({
          onSuccess: () => Effect.void,
          onFailure: (cause) =>
            pipe(
              Effect.Do,
              InteractionContext.replied.bind("replied"),
              InteractionContext.deferred.bind("deferred"),
              Effect.tap(() => Effect.log(cause)),
              Effect.tap(({ replied, deferred }) =>
                pipe(
                  Effect.suspend<
                    Message | InteractionResponse,
                    Cause.UnknownException | DiscordError,
                    InteractionContext<RepliableInteractionT>
                  >(() =>
                    (replied || deferred
                      ? InteractionContext.followUp.sync
                      : InteractionContext.reply.sync)({
                      content: Cause.pretty(cause),
                      flags: MessageFlags.Ephemeral,
                    }),
                  ),
                  // TODO: handle errors
                  Effect.catchAll(() => Effect.void),
                ),
              ),
            ),
        }),
        Effect.unsandbox,
        Effect.withSpan(
          "InteractionHandlerMapWithMetrics.executeAndReplyError",
          {
            captureStackTrace: true,
          },
        ),
      );

  static values = <Data, A, E, R>(
    map: InteractionHandlerMapWithMetrics<Data, A, E, R>,
  ) => InteractionHandlerMap.values(map.map);
}

export class InteractionHandlerMapWithMetricsGroup<
  A = never,
  E = never,
  R = never,
> extends Data.TaggedClass("InteractionHandlerMapWithMetricsGroup")<{
  readonly chatInputCommandsMap: InteractionHandlerMapWithMetrics<
    SharedSlashCommand | SlashCommandSubcommandsOnlyBuilder,
    A,
    E,
    R | InteractionContext<ChatInputCommandInteractionT>
  >;
  readonly buttonsMap: InteractionHandlerMapWithMetrics<
    InteractionButtonComponentData,
    A,
    E,
    R | InteractionContext<ButtonInteractionT>
  >;
  readonly userSelectMenuMap: InteractionHandlerMapWithMetrics<
    UserSelectMenuComponentData,
    A,
    E,
    R | InteractionContext<UserSelectMenuInteractionT>
  >;
}> {
  static empty = <A = never, E = never, R = never>() =>
    new InteractionHandlerMapWithMetricsGroup({
      chatInputCommandsMap: InteractionHandlerMapWithMetrics.make(
        "chat_input_command",
        chatInputInteractionHandlerMap<A, E, R>(),
      ),
      buttonsMap: InteractionHandlerMapWithMetrics.make(
        "button",
        buttonInteractionHandlerMap<A, E, R>(),
      ),
      userSelectMenuMap: InteractionHandlerMapWithMetrics.make(
        "user_select_menu",
        userSelectMenuInteractionHandlerMap<A, E, R>(),
      ),
    });

  static addChatInputCommand = <A = never, E = never, R = never>(
    command: HandlerVariantHandlerContext<ChatInputHandlerVariantT, A, E, R>,
  ) => {
    return <BA = never, BE = never, BR = never>(
      group: InteractionHandlerMapWithMetricsGroup<BA, BE, BR>,
    ) =>
      new InteractionHandlerMapWithMetricsGroup<
        A | BA,
        E | BE,
        Exclude<R, InteractionContext<ChatInputCommandInteractionT>> | BR
      >(
        pipe(
          group,
          Struct.evolve({
            chatInputCommandsMap: (map) =>
              pipe(
                map,
                InteractionHandlerMapWithMetrics.add(
                  command as HandlerVariantHandlerContext<
                    ChatInputHandlerVariantT,
                    A,
                    E,
                    | Exclude<
                        R,
                        InteractionContext<ChatInputCommandInteractionT>
                      >
                    | InteractionContext<ChatInputCommandInteractionT>
                  >,
                ),
              ),
          }),
        ),
      );
  };

  static addChatInputCommandHandlerMap = <A = never, E = never, R = never>(
    commands: HandlerVariantMap<ChatInputHandlerVariantT, A, E, R>,
  ) => {
    return <BA = never, BE = never, BR = never>(
      group: InteractionHandlerMapWithMetricsGroup<BA, BE, BR>,
    ) =>
      new InteractionHandlerMapWithMetricsGroup<
        A | BA,
        E | BE,
        Exclude<R, InteractionContext<ChatInputCommandInteractionT>> | BR
      >(
        pipe(
          group,
          Struct.evolve({
            chatInputCommandsMap: (map) =>
              pipe(
                map,
                InteractionHandlerMapWithMetrics.union(
                  commands as HandlerVariantMap<
                    ChatInputHandlerVariantT,
                    A,
                    E,
                    | Exclude<
                        R,
                        InteractionContext<ChatInputCommandInteractionT>
                      >
                    | InteractionContext<ChatInputCommandInteractionT>
                  >,
                ),
              ),
          }),
        ),
      );
  };

  static addButton = <A = never, E = never, R = never>(
    button: HandlerVariantHandlerContext<ButtonHandlerVariantT, A, E, R>,
  ) => {
    return <BA = never, BE = never, BR = never>(
      group: InteractionHandlerMapWithMetricsGroup<BA, BE, BR>,
    ) =>
      new InteractionHandlerMapWithMetricsGroup<
        A | BA,
        E | BE,
        Exclude<R, InteractionContext<ButtonInteractionT>> | BR
      >(
        pipe(
          group,
          Struct.evolve({
            buttonsMap: (map) =>
              pipe(
                map,
                InteractionHandlerMapWithMetrics.add(
                  button as HandlerVariantHandlerContext<
                    ButtonHandlerVariantT,
                    A,
                    E,
                    | Exclude<R, InteractionContext<ButtonInteractionT>>
                    | InteractionContext<ButtonInteractionT>
                  >,
                ),
              ),
          }),
        ),
      );
  };

  static addButtonInteractionHandlerMap = <A = never, E = never, R = never>(
    buttons: HandlerVariantMap<ButtonHandlerVariantT, A, E, R>,
  ) => {
    return <BA = never, BE = never, BR = never>(
      group: InteractionHandlerMapWithMetricsGroup<BA, BE, BR>,
    ) =>
      new InteractionHandlerMapWithMetricsGroup<
        A | BA,
        E | BE,
        Exclude<R, InteractionContext<ButtonInteractionT>> | BR
      >(
        pipe(
          group,
          Struct.evolve({
            buttonsMap: (map) =>
              pipe(
                map,
                InteractionHandlerMapWithMetrics.union(
                  buttons as HandlerVariantMap<
                    ButtonHandlerVariantT,
                    A,
                    E,
                    | Exclude<R, InteractionContext<ButtonInteractionT>>
                    | InteractionContext<ButtonInteractionT>
                  >,
                ),
              ),
          }),
        ),
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
    return <BA = never, BE = never, BR = never>(
      group: InteractionHandlerMapWithMetricsGroup<BA, BE, BR>,
    ) =>
      new InteractionHandlerMapWithMetricsGroup<
        A | BA,
        E | BE,
        Exclude<R, InteractionContext<UserSelectMenuInteractionT>> | BR
      >(
        pipe(
          group,
          Struct.evolve({
            userSelectMenuMap: (map) =>
              pipe(
                map,
                InteractionHandlerMapWithMetrics.add(
                  userSelectMenu as HandlerVariantHandlerContext<
                    UserSelectMenuHandlerVariantT,
                    A,
                    E,
                    | Exclude<R, InteractionContext<UserSelectMenuInteractionT>>
                    | InteractionContext<UserSelectMenuInteractionT>
                  >,
                ),
              ),
          }),
        ),
      );
  };

  static addUserSelectMenuInteractionHandlerMap = <
    A = never,
    E = never,
    R = never,
  >(
    userSelectMenus: HandlerVariantMap<UserSelectMenuHandlerVariantT, A, E, R>,
  ) => {
    return <BA = never, BE = never, BR = never>(
      group: InteractionHandlerMapWithMetricsGroup<BA, BE, BR>,
    ) =>
      new InteractionHandlerMapWithMetricsGroup<
        A | BA,
        E | BE,
        Exclude<R, InteractionContext<UserSelectMenuInteractionT>> | BR
      >(
        pipe(
          group,
          Struct.evolve({
            userSelectMenuMap: (map) =>
              pipe(
                map,
                InteractionHandlerMapWithMetrics.union(
                  userSelectMenus as HandlerVariantMap<
                    UserSelectMenuHandlerVariantT,
                    A,
                    E,
                    | Exclude<R, InteractionContext<UserSelectMenuInteractionT>>
                    | InteractionContext<UserSelectMenuInteractionT>
                  >,
                ),
              ),
          }),
        ),
      );
  };

  static initialize = (
    map: InteractionHandlerMapWithMetricsGroup<unknown, unknown, unknown>,
  ) =>
    pipe(
      ClientService.getGuilds(),
      Effect.map(HashMap.values),
      Effect.flatMap(
        Effect.forEach((guild) =>
          pipe(
            [map.chatInputCommandsMap, map.buttonsMap, map.userSelectMenuMap],
            Effect.forEach((map) =>
              pipe(
                map.map,
                InteractionHandlerMap.keys,
                Effect.forEach((interactionKey) =>
                  pipe(
                    ["success", "failure"],
                    Effect.forEach((interactionStatus) =>
                      pipe(
                        map.interactionCount,
                        Metric.update(BigInt(0)),
                        Effect.tagMetrics({
                          interaction_type: map.interactionType,
                          interaction_key: interactionKey,
                          interaction_guild_id: guild.id,
                          interaction_status: interactionStatus,
                        }),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
      Effect.asVoid,
      Effect.withSpan("InteractionHandlerMapWithMetricsGroup.initialize", {
        captureStackTrace: true,
      }),
    );

  static chatInputCommandsExecuteAndReplyError =
    (interactionKey: string) =>
    <A, E, R>(group: InteractionHandlerMapWithMetricsGroup<A, E, R>) =>
      pipe(
        group.chatInputCommandsMap,
        InteractionHandlerMapWithMetrics.executeAndReplyError(interactionKey),
        Effect.withSpan(
          "InteractionHandlerMapWithMetricsGroup.chatInputCommandsExecuteAndReplyError",
          {
            captureStackTrace: true,
          },
        ),
      );

  static buttonsExecuteAndReplyError =
    (interactionKey: string) =>
    <A, E, R>(group: InteractionHandlerMapWithMetricsGroup<A, E, R>) =>
      pipe(
        group.buttonsMap,
        InteractionHandlerMapWithMetrics.executeAndReplyError(interactionKey),
        Effect.withSpan(
          "InteractionHandlerMapWithMetricsGroup.buttonsExecuteAndReplyError",
          {
            captureStackTrace: true,
          },
        ),
      );

  static userSelectMenuExecuteAndReplyError =
    (interactionKey: string) =>
    <A, E, R>(group: InteractionHandlerMapWithMetricsGroup<A, E, R>) =>
      pipe(
        group.userSelectMenuMap,
        InteractionHandlerMapWithMetrics.executeAndReplyError(interactionKey),
        Effect.withSpan(
          "InteractionHandlerMapWithMetricsGroup.userSelectMenuExecuteAndReplyError",
          {
            captureStackTrace: true,
          },
        ),
      );
}
