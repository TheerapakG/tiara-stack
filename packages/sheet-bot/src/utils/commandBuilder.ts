import {
  APIApplicationCommandOptionChoice,
  ApplicationIntegrationType,
  ChannelType,
  InteractionContextType,
} from "discord-api-types/v10";
import {
  ApplicationCommandOptionBase,
  ApplicationCommandOptionChannelTypesMixin,
  ApplicationCommandOptionWithChoicesMixin,
  ApplicationCommandOptionWithAutocompleteMixin,
  ApplicationCommandNumericOptionMinMaxValueMixin,
  SharedNameAndDescription,
  SharedSlashCommand,
  SharedSlashCommandOptions,
  SlashCommandBooleanOption,
  SlashCommandBuilder,
  SlashCommandChannelOption,
  SlashCommandIntegerOption,
  SlashCommandNumberOption,
  SlashCommandRoleOption,
  SlashCommandStringOption,
  SharedSlashCommandSubcommands,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandBuilder,
  SlashCommandSubcommandGroupBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  SlashCommandUserOption,
  SlashCommandAttachmentOption,
  SlashCommandMentionableOption,
} from "@discordjs/builders";
import { Discord } from "dfx";
import { Function, Types } from "effect";
import { mix } from "ts-mixer";

interface BuilderTypeLambda<BaseBuilderType> {
  readonly BaseBuilderType: BaseBuilderType;
  readonly InnerType: unknown;
}

type BuilderKind<F extends BuilderTypeLambda<any>, InnerType> = F extends {
  readonly BuilderType: unknown;
}
  ? F & {
      readonly InnerType: InnerType;
    }
  : never;

type BaseBuilderType<F extends BuilderTypeLambda<any>> = F["BaseBuilderType"];
type BuilderType<F extends BuilderTypeLambda<any>, InnerType> = BuilderKind<
  F,
  InnerType
>["BuilderType"];

export const BuilderTypeId = Symbol("CommandBuilder/BuilderTypeId");
export type BuilderTypeId = typeof BuilderTypeId;

interface BuilderVariance<
  in out BuilderT extends BuilderTypeLambda<any>,
  in out InnerType extends unknown,
> {
  [BuilderTypeId]: {
    _BuilderT: Types.Invariant<BuilderT>;
    _InnerType: Types.Invariant<InnerType>;
  };
}

type BuilderBuilderT<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  B extends BuilderVariance<any, any>,
> = [B] extends [BuilderVariance<infer BuilderT, any>] ? BuilderT : never;

type BuilderInnerType<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  B extends BuilderVariance<any, any>,
> = [B] extends [BuilderVariance<any, infer InnerType>] ? InnerType : never;

const builderVariance: <
  BuilderT extends BuilderTypeLambda<any>,
  InnerType extends unknown,
>() => BuilderVariance<BuilderT, InnerType>[BuilderTypeId] = () => ({
  _BuilderT: Function.identity,
  _InnerType: Function.identity,
});

type ReplaceKey<A, Key extends string, Value> = Types.Simplify<
  Omit<A, Key> & { [K in Key]: Value }
>;
type AppendKey<A, Key extends string, Value> = Types.Simplify<
  Omit<A, Key> & {
    [K in Key]: K extends keyof A
      ? A[K] extends infer Arr extends ReadonlyArray<unknown>
        ? [...Arr, Value]
        : [Value]
      : [Value];
  }
>;
type AppendAllKey<A, Key extends string, Value extends ReadonlyArray<unknown>> = Types.Simplify<
  Omit<A, Key> & {
    [K in Key]: K extends keyof A
      ? A[K] extends infer Arr extends ReadonlyArray<unknown>
        ? [...Arr, ...Value]
        : Value
      : Value;
  }
>;

class DummyBase {
  constructor(..._args: any[]) {}
}

abstract class SharedBuilderToJSON<BuilderT extends BuilderTypeLambda<any>, InnerType = unknown> {
  readonly [BuilderTypeId] = builderVariance<BuilderT, InnerType>();
  abstract readonly builder: BaseBuilderType<BuilderT>;

  toJSON(): InnerType {
    return this.builder.toJSON() as InnerType;
  }
}

export abstract class SharedNameAndDescriptionBuilder<
  BuilderT extends BuilderTypeLambda<SharedNameAndDescription>,
  InnerType = unknown,
> {
  readonly [BuilderTypeId] = builderVariance<BuilderT, InnerType>();
  abstract readonly builder: BaseBuilderType<BuilderT>;

  setName<const Name extends string>(name: Name) {
    this.builder.setName(name);
    return this as unknown as BuilderType<
      BuilderBuilderT<typeof this>,
      ReplaceKey<BuilderInnerType<typeof this>, "name", Name>
    >;
  }

  setDescription<const Description extends string>(description: Description) {
    this.builder.setDescription(description);
    return this as unknown as BuilderType<
      BuilderBuilderT<typeof this>,
      ReplaceKey<InnerType, "description", Description>
    >;
  }
}

export abstract class SharedCommand<
  BuilderT extends BuilderTypeLambda<SharedSlashCommand>,
  InnerType = unknown,
> {
  readonly [BuilderTypeId] = builderVariance<BuilderT, InnerType>();
  abstract readonly builder: BaseBuilderType<BuilderT>;

  setContexts<const Contexts extends ReadonlyArray<InteractionContextType>>(...contexts: Contexts) {
    this.builder.setContexts(...contexts);
    return this as unknown as BuilderType<
      BuilderBuilderT<typeof this>,
      ReplaceKey<BuilderInnerType<typeof this>, "contexts", Contexts>
    >;
  }

  setIntegrationTypes<const IntegrationTypes extends ReadonlyArray<ApplicationIntegrationType>>(
    ...integrationTypes: IntegrationTypes
  ) {
    this.builder.setIntegrationTypes(...integrationTypes);
    return this as unknown as BuilderType<
      BuilderBuilderT<typeof this>,
      ReplaceKey<InnerType, "integration_types", IntegrationTypes>
    >;
  }

  setDefaultMemberPermissions<const DefaultMemberPermissions extends bigint>(
    defaultMemberPermissions: DefaultMemberPermissions,
  ) {
    this.builder.setDefaultMemberPermissions(defaultMemberPermissions);
    return this as unknown as BuilderType<
      BuilderBuilderT<typeof this>,
      ReplaceKey<InnerType, "default_member_permissions", DefaultMemberPermissions>
    >;
  }

  setNSFW<const NSFW extends boolean>(nsfw: NSFW) {
    this.builder.setNSFW(nsfw);
    return this as unknown as BuilderType<
      BuilderBuilderT<typeof this>,
      ReplaceKey<InnerType, "nsfw", NSFW>
    >;
  }
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface CommandOptionBuilder<
  BuilderT extends BuilderTypeLambda<ApplicationCommandOptionBase>,
  InnerType = unknown,
> extends SharedNameAndDescriptionBuilder<BuilderT, InnerType> {}

@mix(SharedNameAndDescriptionBuilder)
export abstract class CommandOptionBuilder<
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  BuilderT extends BuilderTypeLambda<ApplicationCommandOptionBase>,
  InnerType = unknown,
> {
  setRequired<const Required extends boolean>(required: Required) {
    this.builder.setRequired(required);
    return this as unknown as BuilderType<
      BuilderBuilderT<typeof this>,
      ReplaceKey<InnerType, "required", Required>
    >;
  }
}

interface AttachmentOptionBuilderTypeLambda extends BuilderTypeLambda<SlashCommandAttachmentOption> {
  readonly BuilderType: AttachmentOptionBuilder<this["InnerType"]>;
}

export class AttachmentOptionBuilder<
  A = { type: typeof Discord.ApplicationCommandOptionType.ATTACHMENT },
> extends CommandOptionBuilder<AttachmentOptionBuilderTypeLambda, A> {
  builder = new SlashCommandAttachmentOption();
}

interface BooleanOptionBuilderTypeLambda extends BuilderTypeLambda<SlashCommandBooleanOption> {
  readonly BuilderType: BooleanOptionBuilder<this["InnerType"]>;
}

export class BooleanOptionBuilder<
  A = { type: typeof Discord.ApplicationCommandOptionType.BOOLEAN },
> extends CommandOptionBuilder<BooleanOptionBuilderTypeLambda, A> {
  builder = new SlashCommandBooleanOption();
}

type AllowedChannelTypes =
  | ChannelType.GuildText
  | ChannelType.GuildVoice
  | ChannelType.GuildCategory
  | ChannelType.GuildAnnouncement
  | ChannelType.AnnouncementThread
  | ChannelType.PublicThread
  | ChannelType.PrivateThread
  | ChannelType.GuildStageVoice
  | ChannelType.GuildForum
  | ChannelType.GuildMedia;

abstract class CommandOptionChannelTypesMixin<
  BuilderT extends BuilderTypeLambda<ApplicationCommandOptionChannelTypesMixin>,
  InnerType = unknown,
> {
  readonly [BuilderTypeId] = builderVariance<BuilderT, InnerType>();
  abstract readonly builder: BaseBuilderType<BuilderT>;

  addChannelTypes<const ChannelTypes extends ReadonlyArray<AllowedChannelTypes>>(
    ...channelTypes: ChannelTypes
  ) {
    this.builder.addChannelTypes(...channelTypes);
    return this as unknown as BuilderType<
      BuilderBuilderT<typeof this>,
      AppendAllKey<BuilderInnerType<typeof this>, "channel_types", ChannelTypes>
    >;
  }
}

interface ChannelOptionBuilderTypeLambda extends BuilderTypeLambda<SlashCommandChannelOption> {
  readonly BuilderType: ChannelOptionBuilder<this["InnerType"]>;
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface ChannelOptionBuilder<
  A = { type: typeof Discord.ApplicationCommandOptionType.CHANNEL },
>
  extends
    CommandOptionBuilder<ChannelOptionBuilderTypeLambda, A>,
    CommandOptionChannelTypesMixin<ChannelOptionBuilderTypeLambda, A> {}

@mix(CommandOptionBuilder, CommandOptionChannelTypesMixin)
export class ChannelOptionBuilder extends DummyBase {
  readonly builder = new SlashCommandChannelOption();
}

abstract class CommandNumericOptionMinMaxValueMixin<
  BuilderT extends BuilderTypeLambda<ApplicationCommandNumericOptionMinMaxValueMixin>,
  InnerType = unknown,
> {
  readonly [BuilderTypeId] = builderVariance<BuilderT, InnerType>();
  abstract readonly builder: BaseBuilderType<BuilderT>;

  setMinValue<const MinValue extends number>(minValue: MinValue) {
    this.builder.setMinValue(minValue);
    return this as unknown as BuilderType<
      BuilderBuilderT<typeof this>,
      ReplaceKey<BuilderInnerType<typeof this>, "min_value", MinValue>
    >;
  }

  setMaxValue<const MaxValue extends number>(maxValue: MaxValue) {
    this.builder.setMaxValue(maxValue);
    return this as unknown as BuilderType<
      BuilderBuilderT<typeof this>,
      ReplaceKey<BuilderInnerType<typeof this>, "max_value", MaxValue>
    >;
  }
}

abstract class CommandOptionWithAutocompleteMixin<
  BuilderT extends BuilderTypeLambda<ApplicationCommandOptionWithAutocompleteMixin>,
  InnerType = unknown,
> {
  readonly [BuilderTypeId] = builderVariance<BuilderT, InnerType>();
  abstract readonly builder: BaseBuilderType<BuilderT>;

  setAutocomplete<const Autocomplete extends boolean>(autocomplete: Autocomplete) {
    this.builder.setAutocomplete(autocomplete);
    return this as unknown as BuilderType<
      BuilderBuilderT<typeof this>,
      ReplaceKey<BuilderInnerType<typeof this>, "autocomplete", Autocomplete>
    >;
  }
}

abstract class CommandOptionWithChoicesMixin<
  ChoiceType extends number | string,
  BuilderT extends BuilderTypeLambda<ApplicationCommandOptionWithChoicesMixin<any>>,
  InnerType = unknown,
> {
  readonly [BuilderTypeId] = builderVariance<BuilderT, InnerType>();
  abstract readonly builder: BaseBuilderType<BuilderT>;

  addChoices<const Choices extends ReadonlyArray<APIApplicationCommandOptionChoice<ChoiceType>>>(
    ...choices: Choices
  ) {
    this.builder.addChoices(...choices);
    return this as unknown as BuilderType<
      BuilderBuilderT<typeof this>,
      AppendAllKey<BuilderInnerType<typeof this>, "choices", Choices>
    >;
  }

  setChoices<const Choices extends ReadonlyArray<APIApplicationCommandOptionChoice<ChoiceType>>>(
    ...choices: Choices
  ) {
    this.builder.setChoices(...choices);
    return this as unknown as BuilderType<
      BuilderBuilderT<typeof this>,
      ReplaceKey<BuilderInnerType<typeof this>, "choices", Choices>
    >;
  }
}

interface IntegerOptionBuilderTypeLambda extends BuilderTypeLambda<SlashCommandIntegerOption> {
  readonly BuilderType: IntegerOptionBuilder<this["InnerType"]>;
}

// Integer option with choices, min/max, and autocomplete
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface IntegerOptionBuilder<
  A = { type: typeof Discord.ApplicationCommandOptionType.INTEGER },
>
  extends
    CommandOptionBuilder<IntegerOptionBuilderTypeLambda, A>,
    CommandNumericOptionMinMaxValueMixin<IntegerOptionBuilderTypeLambda, A>,
    CommandOptionWithChoicesMixin<number, IntegerOptionBuilderTypeLambda, A>,
    CommandOptionWithAutocompleteMixin<IntegerOptionBuilderTypeLambda, A> {}

@mix(
  CommandOptionBuilder,
  CommandNumericOptionMinMaxValueMixin,
  CommandOptionWithChoicesMixin,
  CommandOptionWithAutocompleteMixin,
)
export class IntegerOptionBuilder extends DummyBase {
  readonly builder = new SlashCommandIntegerOption();
}

interface MentionableOptionBuilderTypeLambda extends BuilderTypeLambda<SlashCommandMentionableOption> {
  readonly BuilderType: MentionableOptionBuilder<this["InnerType"]>;
}

export class MentionableOptionBuilder<
  A = { type: typeof Discord.ApplicationCommandOptionType.MENTIONABLE },
> extends CommandOptionBuilder<MentionableOptionBuilderTypeLambda, A> {
  readonly builder = new SlashCommandMentionableOption();
}

interface NumberOptionBuilderTypeLambda extends BuilderTypeLambda<SlashCommandNumberOption> {
  readonly BuilderType: NumberOptionBuilder<this["InnerType"]>;
}

// Number option with choices, min/max, and autocomplete
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface NumberOptionBuilder<
  A = { type: typeof Discord.ApplicationCommandOptionType.NUMBER },
>
  extends
    CommandOptionBuilder<NumberOptionBuilderTypeLambda, A>,
    CommandNumericOptionMinMaxValueMixin<NumberOptionBuilderTypeLambda, A>,
    CommandOptionWithChoicesMixin<number, NumberOptionBuilderTypeLambda, A>,
    CommandOptionWithAutocompleteMixin<NumberOptionBuilderTypeLambda, A> {}

@mix(
  CommandOptionBuilder,
  CommandNumericOptionMinMaxValueMixin,
  CommandOptionWithChoicesMixin,
  CommandOptionWithAutocompleteMixin,
)
export class NumberOptionBuilder extends DummyBase {
  readonly builder = new SlashCommandNumberOption();
}

interface RoleOptionBuilderTypeLambda extends BuilderTypeLambda<SlashCommandRoleOption> {
  readonly BuilderType: RoleOptionBuilder<this["InnerType"]>;
}

export class RoleOptionBuilder<
  A = { type: typeof Discord.ApplicationCommandOptionType.ROLE },
> extends CommandOptionBuilder<RoleOptionBuilderTypeLambda, A> {
  readonly builder = new SlashCommandRoleOption();
}

interface StringOptionBuilderTypeLambda extends BuilderTypeLambda<SlashCommandStringOption> {
  readonly BuilderType: StringOptionBuilder<this["InnerType"]>;
}

// String option with choices and autocomplete
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface StringOptionBuilder<
  A = { type: typeof Discord.ApplicationCommandOptionType.STRING },
>
  extends
    CommandOptionBuilder<StringOptionBuilderTypeLambda, A>,
    CommandOptionWithChoicesMixin<string, StringOptionBuilderTypeLambda, A>,
    CommandOptionWithAutocompleteMixin<StringOptionBuilderTypeLambda, A> {}

@mix(CommandOptionBuilder, CommandOptionWithChoicesMixin, CommandOptionWithAutocompleteMixin)
export class StringOptionBuilder extends DummyBase {
  readonly builder = new SlashCommandStringOption();

  setMinLength<const MinLength extends number>(minLength: MinLength) {
    this.builder.setMinLength(minLength);
    return this as unknown as BuilderType<
      BuilderBuilderT<typeof this>,
      ReplaceKey<BuilderInnerType<typeof this>, "min_length", MinLength>
    >;
  }

  setMaxLength<const MaxLength extends number>(maxLength: MaxLength) {
    this.builder.setMaxLength(maxLength);
    return this as unknown as BuilderType<
      BuilderBuilderT<typeof this>,
      ReplaceKey<BuilderInnerType<typeof this>, "max_length", MaxLength>
    >;
  }
}

interface UserOptionBuilderTypeLambda extends BuilderTypeLambda<SlashCommandUserOption> {
  readonly BuilderType: UserOptionBuilder<this["InnerType"]>;
}

export class UserOptionBuilder<
  A = { type: typeof Discord.ApplicationCommandOptionType.USER },
> extends CommandOptionBuilder<UserOptionBuilderTypeLambda, A> {
  readonly builder = new SlashCommandUserOption();
}

abstract class SharedCommandOptionsBuilder<
  BuilderT extends BuilderTypeLambda<SharedSlashCommandOptions<any>>,
  InnerType = unknown,
> {
  readonly [BuilderTypeId] = builderVariance<BuilderT, InnerType>();
  abstract readonly builder: BaseBuilderType<BuilderT>;

  addBooleanOption<const InnerOption>(
    input: (builder: BooleanOptionBuilder) => BooleanOptionBuilder<InnerOption>,
  ) {
    this.builder.addBooleanOption(input(new BooleanOptionBuilder()).builder);
    return this as unknown as BuilderType<
      BuilderBuilderT<typeof this>,
      AppendKey<BuilderInnerType<typeof this>, "options", InnerOption>
    >;
  }

  addUserOption<const InnerOption>(
    input: (builder: UserOptionBuilder) => UserOptionBuilder<InnerOption>,
  ) {
    this.builder.addUserOption(input(new UserOptionBuilder()).builder);
    return this as unknown as BuilderType<
      BuilderBuilderT<typeof this>,
      AppendKey<BuilderInnerType<typeof this>, "options", InnerOption>
    >;
  }

  addChannelOption<const InnerOption>(
    input: (builder: ChannelOptionBuilder) => ChannelOptionBuilder<InnerOption>,
  ) {
    this.builder.addChannelOption(input(new ChannelOptionBuilder()).builder);
    return this as unknown as BuilderType<
      BuilderBuilderT<typeof this>,
      AppendKey<BuilderInnerType<typeof this>, "options", InnerOption>
    >;
  }

  addRoleOption<const InnerOption>(
    input: (builder: RoleOptionBuilder) => RoleOptionBuilder<InnerOption>,
  ) {
    this.builder.addRoleOption(input(new RoleOptionBuilder()).builder);
    return this as unknown as BuilderType<
      BuilderBuilderT<typeof this>,
      AppendKey<BuilderInnerType<typeof this>, "options", InnerOption>
    >;
  }

  addAttachmentOption<const InnerOption>(
    input: (builder: AttachmentOptionBuilder) => AttachmentOptionBuilder<InnerOption>,
  ) {
    this.builder.addAttachmentOption(input(new AttachmentOptionBuilder()).builder);
    return this as unknown as BuilderType<
      BuilderBuilderT<typeof this>,
      AppendKey<BuilderInnerType<typeof this>, "options", InnerOption>
    >;
  }

  addMentionableOption<const InnerOption>(
    input: (builder: MentionableOptionBuilder) => MentionableOptionBuilder<InnerOption>,
  ) {
    this.builder.addMentionableOption(input(new MentionableOptionBuilder()).builder);
    return this as unknown as BuilderType<
      BuilderBuilderT<typeof this>,
      AppendKey<BuilderInnerType<typeof this>, "options", InnerOption>
    >;
  }

  addStringOption<const InnerOption>(
    input: (builder: StringOptionBuilder) => StringOptionBuilder<InnerOption>,
  ) {
    this.builder.addStringOption(input(new StringOptionBuilder()).builder);
    return this as unknown as BuilderType<
      BuilderBuilderT<typeof this>,
      AppendKey<BuilderInnerType<typeof this>, "options", InnerOption>
    >;
  }

  addIntegerOption<const InnerOption>(
    input: (builder: IntegerOptionBuilder) => IntegerOptionBuilder<InnerOption>,
  ) {
    this.builder.addIntegerOption(input(new IntegerOptionBuilder()).builder);
    return this as unknown as BuilderType<
      BuilderBuilderT<typeof this>,
      AppendKey<BuilderInnerType<typeof this>, "options", InnerOption>
    >;
  }

  addNumberOption<const InnerOption>(
    input: (builder: NumberOptionBuilder) => NumberOptionBuilder<InnerOption>,
  ) {
    this.builder.addNumberOption(input(new NumberOptionBuilder()).builder);
    return this as unknown as BuilderType<
      BuilderBuilderT<typeof this>,
      AppendKey<BuilderInnerType<typeof this>, "options", InnerOption>
    >;
  }
}

interface SubCommandGroupBuilderTypeLambda extends BuilderTypeLambda<SlashCommandSubcommandGroupBuilder> {
  readonly BuilderType: SubCommandGroupBuilder<this["InnerType"]>;
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface SubCommandGroupBuilder<
  A = { type: typeof Discord.ApplicationCommandOptionType.SUB_COMMAND_GROUP },
>
  extends
    SharedNameAndDescriptionBuilder<SubCommandGroupBuilderTypeLambda, A>,
    SharedBuilderToJSON<SubCommandGroupBuilderTypeLambda, A> {}

@mix(SharedNameAndDescriptionBuilder, SharedBuilderToJSON)
export class SubCommandGroupBuilder<
  A = { type: typeof Discord.ApplicationCommandOptionType.SUB_COMMAND_GROUP },
> {
  readonly builder = new SlashCommandSubcommandGroupBuilder();

  addSubcommand<const InnerOption>(
    input: (builder: SubCommandBuilder) => SubCommandBuilder<InnerOption>,
  ) {
    this.builder.addSubcommand(input(new SubCommandBuilder()).builder);
    return this as unknown as BuilderType<
      BuilderBuilderT<typeof this>,
      AppendKey<BuilderInnerType<typeof this>, "options", InnerOption>
    >;
  }

  toJSON(): A {
    return this.builder.toJSON() as A;
  }
}

interface SubCommandBuilderTypeLambda extends BuilderTypeLambda<SlashCommandSubcommandBuilder> {
  readonly BuilderType: SubCommandBuilder<this["InnerType"]>;
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface SubCommandBuilder<
  A = { type: typeof Discord.ApplicationCommandOptionType.SUB_COMMAND },
>
  extends
    SharedNameAndDescriptionBuilder<SubCommandBuilderTypeLambda, A>,
    SharedCommandOptionsBuilder<SubCommandBuilderTypeLambda, A>,
    SharedBuilderToJSON<SubCommandBuilderTypeLambda, A> {}

@mix(SharedNameAndDescriptionBuilder, SharedCommandOptionsBuilder, SharedBuilderToJSON)
export class SubCommandBuilder<
  A = { type: typeof Discord.ApplicationCommandOptionType.SUB_COMMAND },
> {
  readonly builder = new SlashCommandSubcommandBuilder();

  toJSON(): A {
    return this.builder.toJSON() as A;
  }
}

abstract class SharedCommandSubCommandsBuilder<
  BuilderT extends BuilderTypeLambda<SharedSlashCommandSubcommands<any>>,
  InnerType = unknown,
> {
  readonly [BuilderTypeId] = builderVariance<BuilderT, InnerType>();
  abstract readonly builder: BaseBuilderType<BuilderT>;

  addSubcommandGroup<const InnerOption>(
    input: (builder: SubCommandGroupBuilder) => SubCommandGroupBuilder<InnerOption>,
  ) {
    this.builder.addSubcommandGroup(input(new SubCommandGroupBuilder()).builder);
    return this as unknown as BuilderType<
      BuilderBuilderT<typeof this>,
      AppendKey<BuilderInnerType<typeof this>, "options", InnerOption>
    >;
  }

  addSubcommand<const InnerOption>(
    input: (builder: SubCommandBuilder) => SubCommandBuilder<InnerOption>,
  ) {
    this.builder.addSubcommand(input(new SubCommandBuilder()).builder);
    return this as unknown as BuilderType<
      BuilderBuilderT<typeof this>,
      AppendKey<BuilderInnerType<typeof this>, "options", InnerOption>
    >;
  }
}

interface CommandBuilderTypeLambda extends BuilderTypeLambda<SlashCommandBuilder> {
  readonly BuilderType: CommandBuilder<this["InnerType"]>;
}

// @ts-expect-error TypeId is intentionally different
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface CommandBuilder<A = unknown>
  extends
    SharedNameAndDescriptionBuilder<CommandBuilderTypeLambda, A>,
    SharedCommandOptionsBuilder<CommandOptionsOnlyBuilderTypeLambda, A>,
    SharedCommandSubCommandsBuilder<CommandSubCommandsOnlyBuilderTypeLambda, A>,
    SharedCommand<CommandBuilderTypeLambda, A>,
    SharedBuilderToJSON<CommandBuilderTypeLambda, A> {}

interface CommandOptionsOnlyBuilderTypeLambda extends BuilderTypeLambda<SlashCommandOptionsOnlyBuilder> {
  readonly BuilderType: CommandOptionsOnlyBuilder<this["InnerType"]>;
}

// @ts-expect-error TypeId is intentionally different
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface CommandOptionsOnlyBuilder<A = unknown>
  extends
    SharedNameAndDescriptionBuilder<CommandOptionsOnlyBuilderTypeLambda, A>,
    SharedCommandOptionsBuilder<CommandOptionsOnlyBuilderTypeLambda, A>,
    SharedCommand<CommandBuilderTypeLambda, A>,
    SharedBuilderToJSON<CommandOptionsOnlyBuilderTypeLambda, A> {}

interface CommandSubCommandsOnlyBuilderTypeLambda extends BuilderTypeLambda<SlashCommandSubcommandsOnlyBuilder> {
  readonly BuilderType: CommandSubCommandsOnlyBuilder<this["InnerType"]>;
}

// @ts-expect-error TypeId is intentionally different
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface CommandSubCommandsOnlyBuilder<A = unknown>
  extends
    SharedNameAndDescriptionBuilder<CommandSubCommandsOnlyBuilderTypeLambda, A>,
    SharedCommandSubCommandsBuilder<CommandSubCommandsOnlyBuilderTypeLambda, A>,
    SharedCommand<CommandBuilderTypeLambda, A>,
    SharedBuilderToJSON<CommandSubCommandsOnlyBuilderTypeLambda, A> {}

@mix(
  SharedNameAndDescriptionBuilder,
  SharedCommandOptionsBuilder,
  SharedCommandSubCommandsBuilder,
  SharedCommand,
  SharedBuilderToJSON,
)
export class CommandBuilder<A = unknown> {
  readonly builder = new SlashCommandBuilder();

  toJSON(): A {
    return this.builder.toJSON() as A;
  }
}
