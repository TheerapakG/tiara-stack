import { HashSet, Order, Schema } from "effect";
import { Team } from "./team";
import { Option, pipe } from "effect";

export class PlayerTeam extends Schema.TaggedClass<PlayerTeam>()("PlayerTeam", {
  type: Schema.String,
  team: Schema.String,
  lead: Schema.Number,
  backline: Schema.Number,
  talent: Schema.Number,
  tags: Schema.HashSet(Schema.String),
}) {
  static byTalent = Order.mapInput(
    Order.number,
    ({ talent }: PlayerTeam) => talent,
  );

  static addTags(tags: HashSet.HashSet<string>) {
    return (playerTeam: PlayerTeam) =>
      new PlayerTeam({
        type: playerTeam.type,
        team: playerTeam.team,
        lead: playerTeam.lead,
        backline: playerTeam.backline,
        talent: playerTeam.talent,
        tags: HashSet.union(playerTeam.tags, tags),
      });
  }

  static getEffectValue = (playerTeam: PlayerTeam) =>
    playerTeam.lead + (playerTeam.backline - playerTeam.lead) / 5;

  static fromApiObject(apiObject: {
    type: string;
    tagStr: string;
    player: string;
    team: string;
    lead: number;
    backline: number;
    talent: "" | number;
  }) {
    if (apiObject.team === "" || apiObject.talent === "") return Option.none();

    return Option.some(
      new PlayerTeam({
        type: apiObject.type,
        team: apiObject.team,
        lead: apiObject.lead,
        backline: apiObject.backline,
        talent: apiObject.talent,
        tags: HashSet.fromIterable(
          apiObject.tagStr.split(/\s*,\s*/).filter(Boolean),
        ),
      }),
    );
  }

  static fromTeam(cc: boolean, team: Team) {
    const talent = cc
      ? team.talent
      : pipe(
          team.talent,
          Option.orElseSome(() => 0),
        );
    if (
      team.name === "" ||
      Option.isNone(team.lead) ||
      Option.isNone(team.backline) ||
      Option.isNone(talent)
    )
      return Option.none();

    return Option.some(
      new PlayerTeam({
        type: team.type,
        team: team.name,
        lead: team.lead.value,
        backline: team.backline.value,
        talent: talent.value,
        tags: HashSet.fromIterable(team.tags.filter(Boolean)),
      }),
    );
  }
}
