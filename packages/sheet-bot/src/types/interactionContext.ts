import { Interaction } from "discord.js";
import { Context } from "effect";

export class InteractionContext<_I extends Interaction> {
  static interaction<I extends Interaction>() {
    return Context.GenericTag<InteractionContext<I>, I>("InteractionContext");
  }

  static make<I extends Interaction>(interaction: I) {
    return Context.make(this.interaction<I>(), interaction);
  }
}
