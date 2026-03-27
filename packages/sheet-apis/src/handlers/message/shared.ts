import { Option } from "effect";

export const getModernMessageGuildId = <
  T extends {
    guildId: Option.Option<string>;
    messageChannelId: Option.Option<string>;
  },
>(
  record: T,
) =>
  Option.match(record.guildId, {
    onSome: (guildId) =>
      Option.isSome(record.messageChannelId) ? Option.some(guildId) : Option.none(),
    onNone: () => Option.none(),
  });
