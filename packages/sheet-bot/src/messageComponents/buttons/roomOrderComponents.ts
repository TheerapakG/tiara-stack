import { ButtonStyle } from "discord-api-types/v10";
import { makeButtonData, makeMessageActionRowData } from "dfx-discord-utils/utils";

export const previousButtonData = makeButtonData((b) =>
  b
    .setCustomId("interaction:roomOrder:previous")
    .setLabel("Previous")
    .setStyle(ButtonStyle.Secondary),
);

export const nextButtonData = makeButtonData((b) =>
  b.setCustomId("interaction:roomOrder:next").setLabel("Next").setStyle(ButtonStyle.Secondary),
);

export const sendButtonData = makeButtonData((b) =>
  b.setCustomId("interaction:roomOrder:send").setLabel("Send").setStyle(ButtonStyle.Primary),
);

export const tentativePinButtonData = makeButtonData((b) =>
  b
    .setCustomId("interaction:roomOrder:pinTentative")
    .setLabel("Pin")
    .setEmoji({ name: "📌" })
    .setStyle(ButtonStyle.Primary),
);

export const roomOrderActionRow = (
  range: { minRank: number; maxRank: number },
  rank: number,
  disabled = false,
) =>
  makeMessageActionRowData((b) =>
    b.setComponents(
      previousButtonData.setDisabled(disabled || range.minRank === rank),
      nextButtonData.setDisabled(disabled || range.maxRank === rank),
      sendButtonData.setDisabled(disabled),
    ),
  );

export const tentativeRoomOrderActionRow = (
  range: { minRank: number; maxRank: number },
  rank: number,
) =>
  makeMessageActionRowData((b) =>
    b.setComponents(
      previousButtonData.setDisabled(range.minRank === rank),
      nextButtonData.setDisabled(range.maxRank === rank),
      tentativePinButtonData,
    ),
  );

export const tentativeRoomOrderPinActionRow = (disabled = false) =>
  makeMessageActionRowData((b) => b.setComponents(tentativePinButtonData.setDisabled(disabled)));
