import { Order, Schema } from "effect";
import { PlayerTeam } from "./playerTeam";

export class Room extends Schema.TaggedClass<Room>()("Room", {
  enced: Schema.Boolean,
  tiererEnced: Schema.Boolean,
  healed: Schema.Number,
  talent: Schema.Number,
  effectValue: Schema.Number,
  teams: Schema.Chunk(PlayerTeam),
}) {
  static byTalent = Order.mapInput(Order.number, ({ talent }: Room) => talent);
  static byEffectValue = Order.mapInput(Order.number, ({ effectValue }: Room) => effectValue);
  static Order = Order.combine(Room.byTalent, Order.reverse(Room.byEffectValue));

  static avgTalent(room: Room) {
    return room.talent / room.teams.length;
  }

  static avgEffectValue(room: Room) {
    return room.effectValue / room.teams.length;
  }
}
