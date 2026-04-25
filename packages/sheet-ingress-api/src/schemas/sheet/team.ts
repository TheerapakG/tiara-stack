import { Number, Option, Order, Schema, String } from "effect";

export class Team extends Schema.TaggedClass<Team>()("Team", {
  type: Schema.String,
  playerId: Schema.OptionFromNullOr(Schema.String),
  playerName: Schema.OptionFromNullOr(Schema.String),
  teamName: Schema.OptionFromNullOr(Schema.String),
  tags: Schema.Array(Schema.String),
  lead: Schema.Number,
  backline: Schema.Number,
  talent: Schema.OptionFromNullOr(Schema.Number),
}) {
  static getEffectValue = ({ lead, backline }: Team) => lead + (backline - lead) / 5;

  static byPlayerName = Order.mapInput(
    Option.makeOrder(String.Order),
    ({ playerName }: Team) => playerName,
  );

  static byTalent = Order.mapInput(Option.makeOrder(Number.Order), ({ talent }: Team) => talent);

  static byEffectValue = Order.mapInput(Number.Order, Team.getEffectValue);
}
