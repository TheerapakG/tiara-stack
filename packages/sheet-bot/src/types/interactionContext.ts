import { Interaction } from "discord.js";
import { Context } from "effect";

export class InteractionContext<I extends Interaction> {
  $inferInteractionType: I = undefined as unknown as I;

  static interaction<I extends Interaction>() {
    return Context.GenericTag<InteractionContext<I>, I>("InteractionContext");
  }

  static make<I extends Interaction>(interaction: I) {
    return Context.make(this.interaction<I>(), interaction);
  }
}
