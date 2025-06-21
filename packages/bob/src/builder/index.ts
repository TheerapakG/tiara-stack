import { StandardSchemaV1 } from "@standard-schema/spec";

type Simplify<A> = {
  [K in keyof A]: A[K];
} extends infer B
  ? B
  : never;

type ConfigBuilderConfigKeyIsOptional<Key extends string> =
  Key extends `${string}?` ? true : false;

const configBuilderConfigKeyIsOptional = <Key extends string>(
  key: Key
): ConfigBuilderConfigKeyIsOptional<Key> => {
  return key.endsWith("?") as ConfigBuilderConfigKeyIsOptional<Key>;
};

type ConfigBuilderConfigKeyGetBaseKey<Key extends string> =
  Key extends `${infer Base}?` ? Base & string : Key;

const configBuilderConfigKeyGetBaseKey = <Key extends string>(
  key: Key
): ConfigBuilderConfigKeyGetBaseKey<Key> => {
  return key.replace("?", "") as ConfigBuilderConfigKeyGetBaseKey<Key>;
};

type ConfigBuilderConfigEntry<
  Validator extends StandardSchemaV1 = StandardSchemaV1,
  Optional extends boolean = boolean,
> = {
  validator: Validator;
  optional: Optional;
};

type InferConfigBuilderConfigEntryValidator<
  Entry extends ConfigBuilderConfigEntry,
> = Entry["validator"] extends infer T
  ? T extends StandardSchemaV1
    ? T
    : never
  : never;

type InferConfigBuilderConfigEntryOptional<
  Entry extends ConfigBuilderConfigEntry,
> = Entry["optional"] extends infer T ? (T extends boolean ? T : never) : never;

type ConfigBuilderConfig = {
  [key: string]: ConfigBuilderConfigEntry;
};

type InferConfigBuilderConfigKeys<Config extends ConfigBuilderConfig> =
  keyof Config;

type InferConfigBuilderOptionalConfigKeys<Config extends ConfigBuilderConfig> =
  keyof {
    [K in keyof Config as InferConfigBuilderConfigEntryOptional<
      Config[K]
    > extends true
      ? K
      : never]: Config[K];
  } &
    string;

type InferConfigBuilderRequiredConfigKeys<Config extends ConfigBuilderConfig> =
  keyof {
    [K in keyof Config as InferConfigBuilderConfigEntryOptional<
      Config[K]
    > extends false
      ? K
      : never]: Config[K];
  } &
    string;

type InferConfigBuilderConfigIn<Config extends ConfigBuilderConfig> = Simplify<
  {
    [K in InferConfigBuilderRequiredConfigKeys<Config>]: StandardSchemaV1.InferInput<
      InferConfigBuilderConfigEntryValidator<Config[K]>
    >;
  } & {
    [K in InferConfigBuilderOptionalConfigKeys<Config>]?: StandardSchemaV1.InferInput<
      InferConfigBuilderConfigEntryValidator<Config[K]>
    >;
  }
>;

type InferConfigBuilderConfigOut<Config extends ConfigBuilderConfig> = Simplify<
  {
    [K in InferConfigBuilderRequiredConfigKeys<Config>]: StandardSchemaV1.InferOutput<
      InferConfigBuilderConfigEntryValidator<Config[K]>
    >;
  } & {
    [K in InferConfigBuilderOptionalConfigKeys<Config>]?: StandardSchemaV1.InferOutput<
      InferConfigBuilderConfigEntryValidator<Config[K]>
    >;
  }
>;

type AddConfigBuilderConfigEntry<
  Config extends ConfigBuilderConfig,
  Key extends string,
  Entry extends ConfigBuilderConfigEntry,
> = Key extends keyof Config
  ? never
  : Config & {
        [key in Key]: Entry;
      } extends infer T
    ? T extends ConfigBuilderConfig
      ? T
      : never
    : never;

const addConfigBuilderConfigEntry = <
  Config extends ConfigBuilderConfig,
  Key extends string,
  Entry extends ConfigBuilderConfigEntry,
  Keys extends keyof Config = keyof Config,
>(
  config: Config,
  key: Key extends Keys ? never : Key,
  entry: Entry
): AddConfigBuilderConfigEntry<Config, Key, Entry> => {
  return {
    ...config,
    [key]: entry,
  } as AddConfigBuilderConfigEntry<Config, Key, Entry>;
};

type ConfigBuilderCollectedConfig = {
  [key: string]: any;
};

type AddConfigBuilderCollectedConfigEntry<
  Config extends ConfigBuilderCollectedConfig,
  Key extends string,
  Entry,
> = Config & {
  [key in Key]: Entry;
} extends infer T
  ? T extends ConfigBuilderCollectedConfig
    ? T
    : never
  : never;

const addConfigBuilderCollectedConfigEntry = <
  Config extends ConfigBuilderCollectedConfig,
  Key extends string,
  Entry,
>(
  config: Config,
  key: Key,
  entry: Entry
): AddConfigBuilderCollectedConfigEntry<Config, Key, Entry> => {
  return {
    ...config,
    [key]: entry,
  } as AddConfigBuilderCollectedConfigEntry<Config, Key, Entry>;
};

type ConfigBuilderContext<
  Config extends ConfigBuilderConfig = ConfigBuilderConfig,
  Collected extends ConfigBuilderCollectedConfig = ConfigBuilderCollectedConfig,
> = {
  config: Config;
  collected: Collected;
  issues: StandardSchemaV1.Issue[];
};

type InferConfigBuilderContextConfig<Ctx extends ConfigBuilderContext> =
  Ctx["config"] extends infer T
    ? T extends ConfigBuilderConfig
      ? T
      : never
    : never;

type InferConfigBuilderContextCollectedConfig<
  Ctx extends ConfigBuilderContext,
> = Ctx["collected"] extends infer T
  ? T extends ConfigBuilderCollectedConfig
    ? T
    : never
  : never;

type InferSimplifiedConfigBuilderContextCollectedConfig<
  Ctx extends ConfigBuilderContext,
> =
  Simplify<Ctx["collected"]> extends infer T
    ? T extends ConfigBuilderCollectedConfig
      ? T
      : never
    : never;

type AddConfigBuilderContextCollectedConfigEntry<
  Ctx extends ConfigBuilderContext,
  Key extends keyof InferConfigBuilderContextConfig<Ctx> & string,
> = {
  config: InferConfigBuilderContextConfig<Ctx>;
  collected: AddConfigBuilderCollectedConfigEntry<
    InferConfigBuilderContextCollectedConfig<Ctx>,
    Key,
    StandardSchemaV1.InferOutput<
      InferConfigBuilderConfigEntryValidator<
        InferConfigBuilderContextConfig<Ctx>[Key]
      >
    >
  >;
  issues: StandardSchemaV1.Issue[];
} extends infer T
  ? T extends ConfigBuilderContext
    ? T
    : never
  : never;

const addConfigBuilderContextCollectedConfigEntry = <
  Ctx extends ConfigBuilderContext,
  Key extends keyof InferConfigBuilderContextConfig<Ctx> & string,
>(
  ctx: Ctx,
  key: Key,
  entry: StandardSchemaV1.Result<
    InferConfigBuilderConfigEntryValidator<
      InferConfigBuilderContextConfig<Ctx>[Key]
    >
  >
): AddConfigBuilderContextCollectedConfigEntry<Ctx, Key> => {
  if (ctx.issues.length > 0) {
    return {
      config: ctx.config as InferConfigBuilderContextConfig<Ctx>,
      collected: addConfigBuilderCollectedConfigEntry(
        ctx.collected,
        key,
        entry.issues ? entry.issues : entry.value
      ),
      issues: ctx.issues,
    } as AddConfigBuilderContextCollectedConfigEntry<Ctx, Key>;
  }
  if (entry.issues) {
    return {
      config: ctx.config as InferConfigBuilderContextConfig<Ctx>,
      collected: addConfigBuilderCollectedConfigEntry(
        ctx.collected,
        key,
        entry.issues
      ),
      issues: [
        ...ctx.issues,
        ...entry.issues.map((issue) => ({
          message: `In config key ${key}: ${issue.message}`,
          path: issue.path ? [key, ...issue.path] : [key],
        })),
      ],
    } as AddConfigBuilderContextCollectedConfigEntry<Ctx, Key>;
  }
  return {
    config: ctx.config as InferConfigBuilderContextConfig<Ctx>,
    collected: addConfigBuilderCollectedConfigEntry(
      ctx.collected,
      key,
      entry.value
    ),
    issues: [],
  } as AddConfigBuilderContextCollectedConfigEntry<Ctx, Key>;
};

class ConfigBuilder<
  Ctx extends ConfigBuilderContext,
  Config extends
    InferConfigBuilderContextConfig<Ctx> = InferConfigBuilderContextConfig<Ctx>,
  Collected extends
    InferConfigBuilderContextCollectedConfig<Ctx> = InferConfigBuilderContextCollectedConfig<Ctx>,
  Keys extends
    InferConfigBuilderConfigKeys<Config> = InferConfigBuilderConfigKeys<Config>,
  OptionalKeys extends
    InferConfigBuilderOptionalConfigKeys<Config> = InferConfigBuilderOptionalConfigKeys<Config>,
  RequiredKeys extends
    InferConfigBuilderRequiredConfigKeys<Config> = InferConfigBuilderRequiredConfigKeys<Config>,
  ValidKeys extends Exclude<Keys, keyof Collected> & string = Exclude<
    Keys,
    keyof Collected
  > &
    string,
  ValidRequiredKeys extends Exclude<RequiredKeys, keyof Collected> &
    string = Exclude<RequiredKeys, keyof Collected> & string,
> {
  public inferIn: InferConfigBuilderConfigIn<Config> =
    undefined as InferConfigBuilderConfigIn<Config>;
  public inferOut: InferConfigBuilderConfigOut<Config> =
    undefined as InferConfigBuilderConfigOut<Config>;

  constructor(private readonly ctx: Ctx) {}

  static make<Ctx extends ConfigBuilderContext>(ctx: Ctx): ConfigBuilder<Ctx> {
    return new ConfigBuilder(ctx);
  }

  set<
    Key extends ValidKeys,
    Input extends StandardSchemaV1.InferInput<
      InferConfigBuilderConfigEntryValidator<
        InferConfigBuilderContextConfig<Ctx>[Key]
      >
    >,
  >(
    key: Key,
    input: Input
  ): ConfigBuilder<AddConfigBuilderContextCollectedConfigEntry<Ctx, Key>> {
    const validator = this.ctx.config[key].validator as StandardSchemaV1<
      StandardSchemaV1.InferInput<
        InferConfigBuilderConfigEntryValidator<Config[Keys]>
      >,
      StandardSchemaV1.InferOutput<
        InferConfigBuilderConfigEntryValidator<Config[Keys]>
      >
    >;
    const parsedInput = validator["~standard"].validate(input);

    if (parsedInput instanceof Promise) {
      throw new TypeError("Schema validation must be synchronous");
    }

    return ConfigBuilder.make(
      addConfigBuilderContextCollectedConfigEntry(this.ctx, key, parsedInput)
    );
  }

  values(): Exclude<RequiredKeys, keyof Collected> extends never
    ? StandardSchemaV1.Result<Simplify<Collected>>
    : `${ValidRequiredKeys} is not defined` {
    const requiredConfigKeys = new Set(
      Object.entries(this.ctx.config)
        .filter(([_, { optional }]) => !optional)
        .map(([key]) => key)
    );
    const collectedKeys = new Set(Object.keys(this.ctx.collected));
    const requiredKeys = new Set(
      [...requiredConfigKeys].filter((x) => !collectedKeys.has(x))
    ) as Set<RequiredKeys>;

    if (requiredKeys.size > 0) {
      throw new Error("ConfigBuilder has unresolved keys");
    }

    return (
      this.ctx.issues.length > 0
        ? {
            issues: this.ctx.issues,
          }
        : {
            issues: undefined,
            value: this.ctx.collected,
          }
    ) as Exclude<RequiredKeys, keyof Collected> extends never
      ? StandardSchemaV1.Result<Simplify<Collected>>
      : `${ValidRequiredKeys} is not defined`;
  }
}

type ConfigBuilderBuilderContext<
  Config extends ConfigBuilderConfig = ConfigBuilderConfig,
> = {
  config: Config;
};

type InferConfigBuilderBuilderContextConfig<
  Ctx extends ConfigBuilderBuilderContext,
> = Ctx["config"] extends infer T
  ? T extends ConfigBuilderConfig
    ? T
    : never
  : never;

type InferSimplifiedConfigBuilderBuilderContextConfig<
  Ctx extends ConfigBuilderBuilderContext,
> =
  Simplify<Ctx["config"]> extends infer T
    ? T extends ConfigBuilderConfig
      ? T
      : never
    : never;

type MakeConfigBuilderContext<Ctx extends ConfigBuilderBuilderContext> =
  ConfigBuilderContext<
    InferSimplifiedConfigBuilderBuilderContextConfig<Ctx>,
    {}
  > extends infer T
    ? T extends ConfigBuilderContext
      ? T
      : never
    : never;

const makeConfigBuilderContext = <Ctx extends ConfigBuilderBuilderContext>(
  ctx: Ctx
): MakeConfigBuilderContext<Ctx> => {
  return {
    config: ctx.config as InferConfigBuilderBuilderContextConfig<Ctx>,
    collected: {},
    issues: [],
  };
};

type AddConfigBuilderBuilderContextEntry<
  Ctx extends ConfigBuilderBuilderContext,
  Key extends string,
  Entry extends ConfigBuilderConfigEntry,
> = Omit<Ctx, "config"> & {
  config: AddConfigBuilderConfigEntry<
    InferConfigBuilderBuilderContextConfig<Ctx>,
    Key,
    Entry
  >;
} extends infer T
  ? T extends ConfigBuilderBuilderContext
    ? T
    : never
  : never;

const addConfigBuilderBuilderContextEntry = <
  Ctx extends ConfigBuilderBuilderContext,
  Key extends string,
  Entry extends ConfigBuilderConfigEntry,
  Config extends
    InferConfigBuilderBuilderContextConfig<Ctx> = InferConfigBuilderBuilderContextConfig<Ctx>,
  Keys extends keyof Config = keyof Config,
>(
  ctx: Ctx,
  key: Key extends Keys ? never : Key,
  entry: Entry
): AddConfigBuilderBuilderContextEntry<Ctx, Key, Entry> => {
  return {
    ...ctx,
    config: addConfigBuilderConfigEntry<Config, Key, Entry, Keys>(
      ctx.config as Config,
      key,
      entry
    ),
  } as AddConfigBuilderBuilderContextEntry<Ctx, Key, Entry>;
};

class ConfigBuilderBuilder<
  Ctx extends ConfigBuilderBuilderContext,
  Config extends
    InferConfigBuilderBuilderContextConfig<Ctx> = InferConfigBuilderBuilderContextConfig<Ctx>,
  Keys extends keyof Config = keyof Config,
> {
  constructor(private readonly ctx: Ctx) {}

  static make<Ctx extends ConfigBuilderBuilderContext>(
    ctx: Ctx
  ): ConfigBuilderBuilder<Ctx> {
    return new ConfigBuilderBuilder(ctx);
  }

  entry<Key extends string, Validator extends StandardSchemaV1>(
    key: ConfigBuilderConfigKeyGetBaseKey<Key> extends Keys ? never : Key,
    validator: Validator
  ): ConfigBuilderBuilder<
    AddConfigBuilderBuilderContextEntry<
      Ctx,
      ConfigBuilderConfigKeyGetBaseKey<Key>,
      ConfigBuilderConfigEntry<Validator, ConfigBuilderConfigKeyIsOptional<Key>>
    >
  > {
    return ConfigBuilderBuilder.make(
      addConfigBuilderBuilderContextEntry(
        this.ctx,
        configBuilderConfigKeyGetBaseKey<Key>(
          key
        ) as ConfigBuilderConfigKeyGetBaseKey<Key> extends Keys
          ? never
          : ConfigBuilderConfigKeyGetBaseKey<Key>,
        {
          validator,
          optional: configBuilderConfigKeyIsOptional(key),
        }
      )
    );
  }

  build(): ConfigBuilder<MakeConfigBuilderContext<Ctx>> {
    return ConfigBuilder.make(makeConfigBuilderContext(this.ctx));
  }
}

export const configBuilderBuilder = () => {
  return ConfigBuilderBuilder.make({ config: {} });
};
