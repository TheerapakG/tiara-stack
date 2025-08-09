import { Layer, pipe } from "effect";
import { ChannelConfigService } from "../channelConfigService";
import { GuildConfigService } from "../guildConfigService";
import { MessageCheckinService } from "../messageCheckinService";
import { PermissionService } from "../permissionService";
import { SheetConfigService } from "../sheetConfigService";

export const botServices = pipe(
  Layer.mergeAll(
    GuildConfigService.DefaultWithoutDependencies,
    ChannelConfigService.DefaultWithoutDependencies,
    SheetConfigService.DefaultWithoutDependencies,
    MessageCheckinService.DefaultWithoutDependencies,
  ),
  Layer.provideMerge(PermissionService.Default),
);
