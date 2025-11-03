import { Option, Order, pipe, Schema } from "effect";
import { DefaultTaggedClass } from "typhoon-core/schema";

export class Team extends Schema.TaggedClass<Team>()("Team", {
  type: Schema.String,
  playerName: Schema.OptionFromNullishOr(Schema.String, undefined),
  teamName: Schema.OptionFromNullishOr(Schema.String, undefined),
  tags: Schema.Array(Schema.String),
  lead: Schema.OptionFromNullishOr(Schema.Number, undefined),
  backline: Schema.OptionFromNullishOr(Schema.Number, undefined),
  talent: Schema.OptionFromNullishOr(Schema.Number, undefined),
}) {
  static byPlayerName = Order.mapInput(
    Option.getOrder(Schema.String.Order),
    ({ playerName }: Team) => playerName,
  );
  static byTalent = Order.mapInput(
    Option.getOrder(Order.number),
    ({ talent }: Team) => talent,
  );
  static byEffectValue = Order.mapInput(
    Option.getOrder(Order.number),
    Team.getEffectValue,
  );

  static getEffectValue = (team: Team) =>
    pipe(
      Option.Do,
      Option.bind("lead", () => team.lead),
      Option.bind("backline", () => team.backline),
      Option.map(({ lead, backline }) => lead + (backline - lead) / 5),
    );
}
