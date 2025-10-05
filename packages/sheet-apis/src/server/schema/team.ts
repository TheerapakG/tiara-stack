import { Option, pipe, Schema } from "effect";

export class Team extends Schema.TaggedClass<Team>()("Team", {
  type: Schema.String,
  name: Schema.String,
  tags: Schema.Array(Schema.String),
  lead: Schema.OptionFromNullishOr(Schema.Number, undefined),
  backline: Schema.OptionFromNullishOr(Schema.Number, undefined),
  talent: Schema.OptionFromNullishOr(Schema.Number, undefined),
}) {
  static getEffectValue = (team: Team) =>
    pipe(
      Option.Do,
      Option.bind("lead", () => team.lead),
      Option.bind("backline", () => team.backline),
      Option.map(({ lead, backline }) => lead + (backline - lead) / 5),
    );
}
