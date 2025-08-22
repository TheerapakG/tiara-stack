import {
  SharedSlashCommand,
  SharedSlashCommandSubcommands,
  SlashCommandBuilder,
  SlashCommandSubcommandGroupBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";
import { Data, Option, pipe } from "effect";
import { InteractionHandlerContext } from "@/types/handler/handler";
import { HandlerVariantHandlerContext } from "@/types/handler/handlerVariant";
import {
  ChatInputSubcommandGroupHandlerVariantT,
  ChatInputSubcommandHandlerVariantT,
} from "@/types/handler/variants";
import { SubcommandHandler } from "./handler";

type SubcommandHandlerBuilderData<
  Data extends Option.Option<
    | (SharedSlashCommandSubcommands<SlashCommandSubcommandsOnlyBuilder> &
        SharedSlashCommand)
    | SlashCommandSubcommandGroupBuilder
  > = Option.None<
    | (SharedSlashCommandSubcommands<SlashCommandSubcommandsOnlyBuilder> &
        SharedSlashCommand)
    | SlashCommandSubcommandGroupBuilder
  >,
  A = never,
  E = never,
  R = never,
> = {
  _data: Data;
  _handler: SubcommandHandler<A, E, R>;
};

export class SubcommandHandlerBuilder<
  Data extends Option.Option<
    | SlashCommandBuilder
    | SlashCommandSubcommandsOnlyBuilder
    | SlashCommandSubcommandGroupBuilder
  > = Option.None<
    | SlashCommandBuilder
    | SlashCommandSubcommandsOnlyBuilder
    | SlashCommandSubcommandGroupBuilder
  >,
  A = never,
  E = never,
  R = never,
> extends Data.TaggedClass("SubcommandHandlerBuilder")<
  SubcommandHandlerBuilderData<Data, A, E, R>
> {
  static empty<
    BuilderData extends
      | SlashCommandBuilder
      | SlashCommandSubcommandsOnlyBuilder
      | SlashCommandSubcommandGroupBuilder,
    A = never,
    E = never,
    R = never,
  >() {
    return new SubcommandHandlerBuilder({
      _data: Option.none() as Option.None<BuilderData>,
      _handler: SubcommandHandler.empty<A, E, R>(),
    });
  }

  data<
    BuilderData extends
      | SlashCommandBuilder
      | SlashCommandSubcommandsOnlyBuilder
      | SlashCommandSubcommandGroupBuilder,
    A,
    E,
    R,
  >(
    this: SubcommandHandlerBuilder<
      Option.None<
        | SlashCommandBuilder
        | SlashCommandSubcommandsOnlyBuilder
        | SlashCommandSubcommandGroupBuilder
      >,
      A,
      E,
      R
    >,
    data: BuilderData,
  ) {
    return new SubcommandHandlerBuilder({
      _data: Option.some(data) as Option.Some<BuilderData>,
      _handler: this._handler,
    });
  }

  addSubcommandHandler<
    BuilderData extends
      | SlashCommandBuilder
      | SlashCommandSubcommandsOnlyBuilder
      | SlashCommandSubcommandGroupBuilder,
    A,
    E,
    R,
    MA,
    ME,
    MR,
  >(
    this: SubcommandHandlerBuilder<Option.Some<BuilderData>, MA, ME, MR>,
    handler: HandlerVariantHandlerContext<
      ChatInputSubcommandHandlerVariantT,
      A,
      E,
      R
    >,
  ) {
    return new SubcommandHandlerBuilder({
      _data: Option.some(
        this._data.value.addSubcommand(handler.data),
      ) as Option.Some<
        BuilderData extends SlashCommandSubcommandGroupBuilder
          ? SlashCommandSubcommandGroupBuilder
          : SlashCommandSubcommandsOnlyBuilder
      >,
      _handler: pipe(
        this._handler,
        SubcommandHandler.addSubcommandHandler(handler),
      ),
    });
  }

  addSubcommandGroupHandler<
    BuilderData extends
      | SlashCommandBuilder
      | SlashCommandSubcommandsOnlyBuilder,
    A,
    E,
    R,
    MA,
    ME,
    MR,
  >(
    this: SubcommandHandlerBuilder<Option.Some<BuilderData>, MA, ME, MR>,
    handler: HandlerVariantHandlerContext<
      ChatInputSubcommandGroupHandlerVariantT,
      A,
      E,
      R
    >,
  ) {
    return new SubcommandHandlerBuilder({
      _data: Option.some(
        this._data.value.addSubcommandGroup(handler.data),
      ) as Option.Some<SlashCommandSubcommandsOnlyBuilder>,
      _handler: pipe(
        this._handler,
        SubcommandHandler.addSubcommandGroupHandler(handler),
      ),
    });
  }

  toContext<
    BuilderData extends
      | SlashCommandBuilder
      | SlashCommandSubcommandsOnlyBuilder
      | SlashCommandSubcommandGroupBuilder,
  >(this: SubcommandHandlerBuilder<Option.Some<BuilderData>, A, E, R>) {
    return new InteractionHandlerContext({
      data: this._data.value,
      handler: SubcommandHandler.handler(this._handler),
    });
  }
}

export class ChatInputCommandSubcommandHandlerContextBuilder<
  Data extends Option.Option<
    SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder
  > = Option.None<SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder>,
  A = never,
  E = never,
  R = never,
> extends Data.TaggedClass("SubcommandHandlerContextBuilder")<{
  builder: SubcommandHandlerBuilder<Data, A, E, R>;
}> {
  static empty() {
    return new ChatInputCommandSubcommandHandlerContextBuilder({
      builder: SubcommandHandlerBuilder.empty<
        SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder
      >(),
    });
  }

  data<
    BuilderData extends
      | SlashCommandBuilder
      | SlashCommandSubcommandsOnlyBuilder,
    A,
    E,
    R,
  >(
    this: ChatInputCommandSubcommandHandlerContextBuilder<
      Option.None<SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder>,
      A,
      E,
      R
    >,
    data: BuilderData,
  ) {
    return new ChatInputCommandSubcommandHandlerContextBuilder({
      builder: this.builder.data(data),
    });
  }

  addSubcommandHandler<
    BuilderData extends
      | SlashCommandBuilder
      | SlashCommandSubcommandsOnlyBuilder,
    A,
    E,
    R,
    MA,
    ME,
    MR,
  >(
    this: ChatInputCommandSubcommandHandlerContextBuilder<
      Option.Some<BuilderData>,
      MA,
      ME,
      MR
    >,
    handler: HandlerVariantHandlerContext<
      ChatInputSubcommandHandlerVariantT,
      A,
      E,
      R
    >,
  ) {
    return new ChatInputCommandSubcommandHandlerContextBuilder({
      builder: this.builder.addSubcommandHandler(handler),
    });
  }

  addSubcommandGroupHandler<
    BuilderData extends
      | SlashCommandBuilder
      | SlashCommandSubcommandsOnlyBuilder,
    A,
    E,
    R,
    MA,
    ME,
    MR,
  >(
    this: ChatInputCommandSubcommandHandlerContextBuilder<
      Option.Some<BuilderData>,
      MA,
      ME,
      MR
    >,
    handler: HandlerVariantHandlerContext<
      ChatInputSubcommandGroupHandlerVariantT,
      A,
      E,
      R
    >,
  ) {
    return new ChatInputCommandSubcommandHandlerContextBuilder({
      builder: this.builder.addSubcommandGroupHandler(handler),
    });
  }

  build<
    BuilderData extends
      | SlashCommandBuilder
      | SlashCommandSubcommandsOnlyBuilder,
    A,
    E,
    R,
  >(
    this: ChatInputCommandSubcommandHandlerContextBuilder<
      Option.Some<BuilderData>,
      A,
      E,
      R
    >,
  ) {
    return this.builder.toContext();
  }
}

export class ChatInputSubcommandGroupSubcommandHandlerContextBuilder<
  Data extends
    Option.Option<SlashCommandSubcommandGroupBuilder> = Option.None<SlashCommandSubcommandGroupBuilder>,
  A = never,
  E = never,
  R = never,
> extends Data.TaggedClass(
  "ChatInputSubcommandGroupSubcommandHandlerContextBuilder",
)<{
  builder: SubcommandHandlerBuilder<Data, A, E, R>;
}> {
  static empty() {
    return new ChatInputSubcommandGroupSubcommandHandlerContextBuilder({
      builder:
        SubcommandHandlerBuilder.empty<SlashCommandSubcommandGroupBuilder>(),
    });
  }

  data<BuilderData extends SlashCommandSubcommandGroupBuilder, A, E, R>(
    this: ChatInputSubcommandGroupSubcommandHandlerContextBuilder<
      Option.None<SlashCommandSubcommandGroupBuilder>,
      A,
      E,
      R
    >,
    data: BuilderData,
  ) {
    return new ChatInputSubcommandGroupSubcommandHandlerContextBuilder({
      builder: this.builder.data(data),
    });
  }

  addSubcommandHandler<
    BuilderData extends SlashCommandSubcommandGroupBuilder,
    A,
    E,
    R,
    MA,
    ME,
    MR,
  >(
    this: ChatInputSubcommandGroupSubcommandHandlerContextBuilder<
      Option.Some<BuilderData>,
      MA,
      ME,
      MR
    >,
    handler: HandlerVariantHandlerContext<
      ChatInputSubcommandHandlerVariantT,
      A,
      E,
      R
    >,
  ) {
    return new ChatInputSubcommandGroupSubcommandHandlerContextBuilder({
      builder: this.builder.addSubcommandHandler(handler),
    });
  }

  build<BuilderData extends SlashCommandSubcommandGroupBuilder, A, E, R>(
    this: ChatInputSubcommandGroupSubcommandHandlerContextBuilder<
      Option.Some<BuilderData>,
      A,
      E,
      R
    >,
  ) {
    return this.builder.toContext();
  }
}

export const chatInputCommandSubcommandHandlerContextBuilder = () =>
  ChatInputCommandSubcommandHandlerContextBuilder.empty();

export const chatInputSubcommandGroupSubcommandHandlerContextBuilder = () =>
  ChatInputSubcommandGroupSubcommandHandlerContextBuilder.empty();
