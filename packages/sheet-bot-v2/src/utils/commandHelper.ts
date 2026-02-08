import { Discord, DiscordREST, Ix } from "dfx";
import { CommandHelper } from "dfx/Interactions/commandHelper";
import {
  SubCommandNotFound,
  type DiscordApplicationCommand,
  type DiscordInteraction,
} from "dfx/Interactions/context";
import { Array, Deferred, Effect, FiberMap, Option, pipe } from "effect";
import { DiscordApplication } from "../discord/gateway";
import {
  CommandBuilder,
  CommandOptionsOnlyBuilder,
  CommandSubCommandsOnlyBuilder,
  SubCommandBuilder,
  SubCommandGroupBuilder,
} from "./commandBuilder";
import { DiscordRestService } from "dfx/DiscordREST";

type CommandOptionType = Exclude<
  Discord.ApplicationCommandOptionType,
  | typeof Discord.ApplicationCommandOptionType.SUB_COMMAND
  | typeof Discord.ApplicationCommandOptionType.SUB_COMMAND_GROUP
>;

interface CommandOption {
  readonly type: any;
  readonly name: string;
  readonly options?: ReadonlyArray<CommandOption>;
}

type StringLiteral<T> = T extends string ? (string extends T ? never : T) : never;

type Option<A> = A extends { readonly name: infer N }
  ? N extends StringLiteral<N>
    ? A
    : never
  : never;

type OptionsWithLiteral<A, T> = A extends {
  readonly options: ReadonlyArray<CommandOption>;
}
  ? Extract<A["options"][number], Option<A["options"][number]> & T>
  : never;

type SubCommandGroups<A> = A extends { readonly options: ReadonlyArray<CommandOption> }
  ? Extract<
      A["options"][number],
      {
        readonly type: typeof Discord.ApplicationCommandOptionType.SUB_COMMAND_GROUP;
        readonly options?: ReadonlyArray<CommandOption>;
      }
    >
  : never;

type SubCommandGroupNames<A> = Option<SubCommandGroups<A>>["name"];

type SubCommands<A> = A extends { readonly options: ReadonlyArray<CommandOption> }
  ? Extract<
      A["options"][number],
      {
        readonly type: typeof Discord.ApplicationCommandOptionType.SUB_COMMAND;
        readonly options?: ReadonlyArray<CommandOption>;
      }
    >
  : never;

type SubCommandNames<A> = Option<SubCommands<A>>["name"];

type SubCommandWithName<A, Name extends SubCommandGroupNames<A> | SubCommandNames<A>> = A extends {
  readonly options: ReadonlyArray<CommandOption>;
}
  ? Extract<
      A["options"][number],
      {
        readonly type:
          | typeof Discord.ApplicationCommandOptionType.SUB_COMMAND_GROUP
          | typeof Discord.ApplicationCommandOptionType.SUB_COMMAND;
        readonly options?: ReadonlyArray<CommandOption>;
        readonly name: Name;
      }
    >
  : never;

type CommandOptions<A> = OptionsWithLiteral<
  A,
  {
    readonly type: CommandOptionType;
  }
>;

type RequiredCommandOptions<A> = OptionsWithLiteral<
  A,
  {
    readonly type: CommandOptionType;
    readonly required: true;
  }
>;

type CommandWithName<A, N> = Extract<CommandOptions<A>, { readonly name: N }>;

type ResolvableType =
  | typeof Discord.ApplicationCommandOptionType.ROLE
  | typeof Discord.ApplicationCommandOptionType.USER
  | typeof Discord.ApplicationCommandOptionType.MENTIONABLE
  | typeof Discord.ApplicationCommandOptionType.CHANNEL;

type ResolvableOptions<A> = OptionsWithLiteral<A, { readonly type: ResolvableType }>;
type RoleOptions<A> = OptionsWithLiteral<
  A,
  { readonly type: typeof Discord.ApplicationCommandOptionType.ROLE }
>;
type UserOptions<A> = OptionsWithLiteral<
  A,
  { readonly type: typeof Discord.ApplicationCommandOptionType.USER }
>;
type MentionableOptions<A> = OptionsWithLiteral<
  A,
  { readonly type: typeof Discord.ApplicationCommandOptionType.MENTIONABLE }
>;
type ChannelOptions<A> = OptionsWithLiteral<
  A,
  { readonly type: typeof Discord.ApplicationCommandOptionType.CHANNEL }
>;

type RequiredRoleOptions<A> = OptionsWithLiteral<
  A,
  { readonly type: typeof Discord.ApplicationCommandOptionType.ROLE; readonly required: true }
>;
type RequiredUserOptions<A> = OptionsWithLiteral<
  A,
  { readonly type: typeof Discord.ApplicationCommandOptionType.USER; readonly required: true }
>;
type RequiredMentionableOptions<A> = OptionsWithLiteral<
  A,
  {
    readonly type: typeof Discord.ApplicationCommandOptionType.MENTIONABLE;
    readonly required: true;
  }
>;
type RequiredChannelOptions<A> = OptionsWithLiteral<
  A,
  { readonly type: typeof Discord.ApplicationCommandOptionType.CHANNEL; readonly required: true }
>;

type CommandRoleValue<A, N> = CommandWithName<
  A,
  N
>["type"] extends typeof Discord.ApplicationCommandOptionType.ROLE
  ? Discord.GuildRoleResponse
  : string;
type CommandUserValue<A, N> = CommandWithName<
  A,
  N
>["type"] extends typeof Discord.ApplicationCommandOptionType.USER
  ? Discord.UserResponse | Discord.GuildMemberResponse
  : string;
type CommandMentionableValue<A, N> = CommandWithName<
  A,
  N
>["type"] extends typeof Discord.ApplicationCommandOptionType.MENTIONABLE
  ? Discord.GuildRoleResponse | Discord.UserResponse | Discord.GuildMemberResponse
  : string;
type CommandChannelValue<A, N> = CommandWithName<
  A,
  N
>["type"] extends typeof Discord.ApplicationCommandOptionType.CHANNEL
  ? Discord.GuildChannelResponse
  : string;

export class WrappedCommandHelper<A> {
  constructor(
    readonly helper: CommandHelper<A>,
    private readonly subcommandGroupOptionName: Option.Option<string>,
    private readonly subcommandOptionName: Option.Option<string>,
    readonly rest: DiscordRestService,
    private readonly application: DiscordApplication,
    readonly response: Deferred.Deferred<{
      readonly files: ReadonlyArray<File>;
      readonly payload: Discord.CreateInteractionResponseRequest;
    }>,
  ) {}
  get data() {
    return this.helper.data;
  }
  get target() {
    return this.helper.target;
  }

  resolve<T>(
    name: ResolvableOptions<A>["name"],
    f: (id: Discord.Snowflake, data: Discord.InteractionDataResolved) => T | undefined,
  ) {
    return this.helper.resolve(name, f);
  }

  resolvedValues<T>(
    f: (id: Discord.Snowflake, data: Discord.InteractionDataResolved) => T | undefined,
  ) {
    return this.helper.resolvedValues(f);
  }

  option(name: CommandOptions<A>["name"]) {
    return this.helper.option(name);
  }

  optionValue<N extends RequiredCommandOptions<A>["name"]>(name: N) {
    return this.helper.optionValue(name);
  }

  optionValueOptional<N extends CommandOptions<A>["name"]>(name: N) {
    return this.helper.optionValueOptional(name);
  }

  optionValueOrElse<N extends CommandOptions<A>["name"], const OrElse>(
    name: N,
    orElse: () => OrElse,
  ) {
    return this.helper.optionValueOrElse(name, orElse);
  }

  optionRoleValue<N extends RequiredRoleOptions<A>["name"]>(name: N): CommandRoleValue<A, N> {
    return Option.getOrThrow(this.optionRoleValueOptional(name));
  }

  optionRoleValueOptional<N extends RoleOptions<A>["name"]>(
    name: N,
  ): Option.Option<CommandRoleValue<A, N>> {
    return this.helper.resolve(name, (id, data) => data.roles?.[id]);
  }

  optionRoleValueOrElse<N extends RoleOptions<A>["name"]>(
    name: N,
    orElse: () => CommandRoleValue<A, N>,
  ): CommandRoleValue<A, N> {
    return this.optionRoleValueOptional(name).pipe(Option.getOrElse(orElse));
  }

  optionUserValue<N extends RequiredUserOptions<A>["name"]>(name: N): CommandUserValue<A, N> {
    return Option.getOrThrow(this.optionUserValueOptional(name));
  }

  optionUserValueOptional<N extends UserOptions<A>["name"]>(
    name: N,
  ): Option.Option<CommandUserValue<A, N>> {
    return this.helper.resolve(name, (id, data) => data.members?.[id] ?? data.users?.[id]);
  }

  optionUserValueOrElse<N extends UserOptions<A>["name"]>(
    name: N,
    orElse: () => CommandUserValue<A, N>,
  ): CommandUserValue<A, N> {
    return this.optionUserValueOptional(name).pipe(Option.getOrElse(orElse));
  }

  optionMentionableValue<N extends RequiredMentionableOptions<A>["name"]>(
    name: N,
  ): CommandMentionableValue<A, N> {
    return Option.getOrThrow(this.optionMentionableValueOptional(name));
  }

  optionMentionableValueOptional<N extends MentionableOptions<A>["name"]>(
    name: N,
  ): Option.Option<CommandMentionableValue<A, N>> {
    return this.helper.resolve(
      name,
      (id, data) => data.roles?.[id] ?? data.members?.[id] ?? data.users?.[id],
    );
  }

  optionMentionableValueOrElse<N extends MentionableOptions<A>["name"]>(
    name: N,
    orElse: () => CommandMentionableValue<A, N>,
  ): CommandMentionableValue<A, N> {
    return this.optionMentionableValueOptional(name).pipe(Option.getOrElse(orElse));
  }

  optionChannelValue<N extends RequiredChannelOptions<A>["name"]>(
    name: N,
  ): CommandChannelValue<A, N> {
    return Option.getOrThrow(this.optionChannelValueOptional(name));
  }

  optionChannelValueOptional<N extends ChannelOptions<A>["name"]>(
    name: N,
  ): Option.Option<CommandChannelValue<A, N>> {
    return this.helper.resolve(name, (id, data) => data.channels?.[id]);
  }

  optionChannelValueOrElse<N extends ChannelOptions<A>["name"]>(
    name: N,
    orElse: () => CommandChannelValue<A, N>,
  ): CommandChannelValue<A, N> {
    return this.optionChannelValueOptional(name).pipe(Option.getOrElse(orElse));
  }

  subCommands<
    NER extends SubCommandGroupNames<A> | SubCommandNames<A> extends never
      ? never
      : {
          [Name in SubCommandGroupNames<A> | SubCommandNames<A>]: (
            commandHelper: WrappedCommandHelper<SubCommandWithName<A, Name>>,
          ) => Effect.Effect<unknown, any, any>;
        },
  >(
    commands: NER,
  ): Effect.Effect<
    unknown,
    [ReturnType<NER[keyof NER]>] extends [{ [Effect.EffectTypeId]: { _E: (_: never) => infer E } }]
      ? E
      : never,
    [ReturnType<NER[keyof NER]>] extends [{ [Effect.EffectTypeId]: { _R: (_: never) => infer R } }]
      ? R
      : never | DiscordInteraction | DiscordApplicationCommand
  > {
    const commands_ = commands as Record<string, any>;

    return pipe(
      this.subcommandGroupOptionName,
      Option.match({
        onSome: (name) =>
          Effect.mapError(
            Array.findFirst(
              "options" in this.data ? (this.data.options ?? []) : [],
              (option) =>
                option.type === Discord.ApplicationCommandOptionType.SUB_COMMAND_GROUP &&
                option.name === name &&
                !!commands_[name],
            ),
            () => new SubCommandNotFound({ data: this.data }),
          ).pipe(
            Effect.flatMap((command) =>
              commands_[command.name](
                new WrappedCommandHelper(
                  this.helper,
                  Option.none(),
                  this.subcommandOptionName,
                  this.rest,
                  this.application,
                  this.response,
                ),
              ),
            ),
          ),
        onNone: () =>
          pipe(
            this.subcommandOptionName,
            Option.match({
              onSome: (name) =>
                Effect.mapError(
                  Array.findFirst(
                    "options" in this.data ? (this.data.options ?? []) : [],
                    (option) =>
                      option.type === Discord.ApplicationCommandOptionType.SUB_COMMAND &&
                      option.name === name &&
                      !!commands_[name],
                  ),
                  () => new SubCommandNotFound({ data: this.data }),
                ).pipe(
                  Effect.flatMap((command) =>
                    commands_[command.name](
                      new WrappedCommandHelper(
                        this.helper,
                        Option.none(),
                        Option.none(),
                        this.rest,
                        this.application,
                        this.response,
                      ),
                    ),
                  ),
                ),
              onNone: () => new SubCommandNotFound({ data: this.data }),
            }),
          ),
      }),
    ) as any;
  }

  get optionsMap() {
    return this.helper.optionsMap;
  }

  reply(payload?: Discord.IncomingWebhookInteractionRequest) {
    return Deferred.succeed(this.response, {
      files: [],
      payload: {
        type: Discord.InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
        data: payload,
      },
    });
  }

  replyWithFiles(files: ReadonlyArray<File>, response?: Discord.IncomingWebhookInteractionRequest) {
    return Deferred.succeed(this.response, {
      files,
      payload: {
        type: Discord.InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
        data: response,
      },
    });
  }

  deferReply(response?: Discord.IncomingWebhookInteractionRequest) {
    return Deferred.succeed(this.response, {
      files: [],
      payload: {
        type: Discord.InteractionCallbackTypes.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
        data: response,
      },
    });
  }

  editReply(response: {
    readonly params?: Discord.UpdateOriginalWebhookMessageParams;
    readonly payload: Discord.IncomingWebhookUpdateRequestPartial;
  }) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const command = this;

    return Effect.gen(function* () {
      const context = yield* Ix.Interaction;

      return yield* command.rest.updateOriginalWebhookMessage(
        command.application.id,
        context.token,
        response,
      );
    });
  }

  editReplyWithFiles(
    files: ReadonlyArray<File>,
    response: {
      readonly params?: Discord.UpdateOriginalWebhookMessageParams;
      readonly payload: Discord.IncomingWebhookUpdateRequestPartial;
    },
  ) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const command = this;

    return Effect.gen(function* () {
      const context = yield* Ix.Interaction;

      return yield* command.rest.withFiles(files)(
        command.rest.updateOriginalWebhookMessage(command.application.id, context.token, response),
      );
    });
  }
}

export const wrapCommandHelper = Effect.fnUntraced(function* <A>(
  helper: CommandHelper<A>,
  rest: DiscordRestService,
  application: DiscordApplication,
) {
  const response = yield* Deferred.make<{
    readonly files: ReadonlyArray<File>;
    readonly payload: Discord.CreateInteractionResponseRequest;
  }>();
  return new WrappedCommandHelper(
    helper,
    Array.findFirst(
      "options" in helper.data ? (helper.data.options ?? []) : [],
      (option) => option.type === Discord.ApplicationCommandOptionType.SUB_COMMAND_GROUP,
    ).pipe(Option.map((option) => option.name)),
    Array.findFirst(
      "options" in helper.data ? (helper.data.options ?? []) : [],
      (option) => option.type === Discord.ApplicationCommandOptionType.SUB_COMMAND,
    ).pipe(Option.map((option) => option.name)),
    rest,
    application,
    response,
  );
});

export const makeForkedCommandHandler = Effect.fnUntraced(function* <
  const A extends Discord.ApplicationCommandCreateRequest,
  E = never,
  R = never,
>(handler: (commandHelper: WrappedCommandHelper<A>) => Effect.Effect<unknown, E, R>) {
  const fiberMap = yield* FiberMap.make<Discord.Snowflake>();

  return Effect.fnUntraced(function* (commandHelper: WrappedCommandHelper<A>) {
    const context = yield* Ix.Interaction;

    yield* pipe(handler(commandHelper), FiberMap.run(fiberMap, context.id));
  });
});

export const makeSubCommandGroup = Effect.fnUntraced(function* <
  const A extends Discord.ApplicationCommandSubcommandGroupOption,
  E = never,
  R = never,
>(
  data: (builder: SubCommandGroupBuilder) => SubCommandGroupBuilder<A>,
  handler: (commandHelper: WrappedCommandHelper<A>) => Effect.Effect<unknown, E, R>,
) {
  const forkedHandler = yield* makeForkedCommandHandler(handler);
  return {
    data: data(new SubCommandGroupBuilder()),
    handler: forkedHandler,
  };
});

export const makeSubCommand = Effect.fnUntraced(function* <
  const A extends Discord.ApplicationCommandSubcommandOption,
  E = never,
  R = never,
>(
  data: (builder: SubCommandBuilder) => SubCommandBuilder<A>,
  handler: (
    commandHelper: WrappedCommandHelper<
      A & { readonly type: typeof Discord.ApplicationCommandOptionType.SUB_COMMAND }
    >,
  ) => Effect.Effect<unknown, E, R>,
) {
  const forkedHandler = yield* makeForkedCommandHandler(handler);
  return {
    data: data(new SubCommandBuilder()),
    handler: forkedHandler,
  };
});

export const makeCommand = Effect.fnUntraced(function* <
  const A extends Discord.ApplicationCommandCreateRequest,
  E = never,
  R = never,
>(
  data: (
    builder: CommandBuilder,
  ) => CommandBuilder<A> | CommandOptionsOnlyBuilder<A> | CommandSubCommandsOnlyBuilder<A>,
  handler: (commandHelper: WrappedCommandHelper<A>) => Effect.Effect<unknown, E, R>,
) {
  const rest = yield* DiscordREST;
  const application = yield* DiscordApplication;
  const forkedHandler = yield* makeForkedCommandHandler(
    Effect.fnUntraced(function* (commandHelper: WrappedCommandHelper<A>) {
      yield* handler(commandHelper);
      yield* commandHelper.reply({ content: "The command did not set a response." });
    }),
  );
  return {
    data: data(new CommandBuilder()).toJSON(),
    handler: Effect.fnUntraced(function* (commandHelper: CommandHelper<A>) {
      const wrappedCommandHelper = yield* wrapCommandHelper(commandHelper, rest, application);
      yield* forkedHandler(wrappedCommandHelper);
      const { files, payload } = yield* wrappedCommandHelper.response;
      return {
        files,
        ...payload,
      };
    }),
  };
});

export const makeGlobalCommand = <
  const A extends Discord.ApplicationCommandCreateRequest,
  E = never,
  R = never,
>(
  data: A,
  handler: (
    commandHelper: CommandHelper<A>,
  ) => Effect.Effect<Discord.CreateInteractionResponseRequest, E, R>,
) => Ix.global(data, handler);

export const makeGuildCommand = <
  const A extends Discord.ApplicationCommandCreateRequest,
  E = never,
  R = never,
>(
  data: A,
  handler: (
    commandHelper: CommandHelper<A>,
  ) => Effect.Effect<Discord.CreateInteractionResponseRequest, E, R>,
) => Ix.guild(data, handler);
