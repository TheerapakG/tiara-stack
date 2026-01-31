import { Number, Option, Order, Schema, String } from "effect";

export class Team extends Schema.TaggedClass<Team>()("Team", {
  type: Schema.String,
  playerName: Schema.OptionFromNullishOr(Schema.String, undefined),
  teamName: Schema.OptionFromNullishOr(Schema.String, undefined),
  tags: Schema.Array(Schema.String),
  lead: Schema.Number,
  backline: Schema.Number,
  talent: Schema.OptionFromNullishOr(Schema.Number, undefined),
}) {
  static getEffectValue = ({ lead, backline }: Team) => lead + (backline - lead) / 5;

  static byPlayerName = Order.mapInput(
    Option.getOrder(String.Order),
    ({ playerName }: Team) => playerName,
  );

  static byTalent = Order.mapInput(Option.getOrder(Number.Order), ({ talent }: Team) => talent);

  static byEffectValue = Order.mapInput(Number.Order, Team.getEffectValue);
}
