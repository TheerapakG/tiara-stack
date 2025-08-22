import { Data, Effect, Option, pipe } from "effect";
import { InteractionContext } from "../../../services";
import { bindObject } from "../../../utils";
import { InteractionHandler, InteractionHandlerMap } from "../handler";
import {
  HandlerVariantHandlerContext,
  HandlerVariantMap,
} from "../handlerVariant";
import {
  ChatInputSubcommandGroupHandlerVariantT,
  ChatInputSubcommandHandlerVariantT,
  chatInputSubcommandGroupInteractionHandlerMap,
  chatInputSubcommandInteractionHandlerMap,
} from "../variants";

export type SubcommandHandlerObject<A = never, E = never, R = never> = {
  subcommandGroupHandlerMap: HandlerVariantMap<
    ChatInputSubcommandGroupHandlerVariantT,
    A,
    E,
    R
  >;
  subcommandHandlerMap: HandlerVariantMap<
    ChatInputSubcommandHandlerVariantT,
    A,
    E,
    R
  >;
};

export class SubcommandHandler<
  A = never,
  E = never,
  R = never,
> extends Data.TaggedClass("SubcommandHandler")<
  SubcommandHandlerObject<A, E, R>
> {
  static empty<A = never, E = never, R = never>() {
    return new SubcommandHandler({
      subcommandGroupHandlerMap: chatInputSubcommandGroupInteractionHandlerMap<
        A,
        E,
        R
      >(),
      subcommandHandlerMap: chatInputSubcommandInteractionHandlerMap<A, E, R>(),
    });
  }

  static addSubcommandGroupHandler<A = never, E = never, R = never>(
    handler: HandlerVariantHandlerContext<
      ChatInputSubcommandGroupHandlerVariantT,
      A,
      E,
      R
    >,
  ) {
    return <MA = never, ME = never, MR = never>(
      map: SubcommandHandler<MA, ME, MR>,
    ) =>
      new SubcommandHandler({
        subcommandGroupHandlerMap: pipe(
          map.subcommandGroupHandlerMap,
          InteractionHandlerMap.add(handler),
        ),
        subcommandHandlerMap: map.subcommandHandlerMap,
      });
  }

  static addSubcommandGroupHandlerMap<A = never, E = never, R = never>(
    handlerMap: HandlerVariantMap<
      ChatInputSubcommandGroupHandlerVariantT,
      A,
      E,
      R
    >,
  ) {
    return <MA = never, ME = never, MR = never>(
      map: SubcommandHandler<MA, ME, MR>,
    ) =>
      new SubcommandHandler({
        subcommandGroupHandlerMap: pipe(
          map.subcommandGroupHandlerMap,
          InteractionHandlerMap.union(handlerMap),
        ),
        subcommandHandlerMap: map.subcommandHandlerMap,
      });
  }

  static addSubcommandHandler<A = never, E = never, R = never>(
    handler: HandlerVariantHandlerContext<
      ChatInputSubcommandHandlerVariantT,
      A,
      E,
      R
    >,
  ) {
    return <MA = never, ME = never, MR = never>(
      map: SubcommandHandler<MA, ME, MR>,
    ) =>
      new SubcommandHandler({
        subcommandGroupHandlerMap: map.subcommandGroupHandlerMap,
        subcommandHandlerMap: pipe(
          map.subcommandHandlerMap,
          InteractionHandlerMap.add(handler),
        ),
      });
  }

  static addSubcommandHandlerMap<A = never, E = never, R = never>(
    handlerMap: HandlerVariantMap<ChatInputSubcommandHandlerVariantT, A, E, R>,
  ) {
    return <MA = never, ME = never, MR = never>(
      map: SubcommandHandler<MA, ME, MR>,
    ) =>
      new SubcommandHandler({
        subcommandGroupHandlerMap: map.subcommandGroupHandlerMap,
        subcommandHandlerMap: pipe(
          map.subcommandHandlerMap,
          InteractionHandlerMap.union(handlerMap),
        ),
      });
  }

  static handler<A = never, E = never, R = never>(
    handler: SubcommandHandler<A, E, R>,
  ) {
    return pipe(
      Effect.Do,
      bindObject({
        subcommandGroup: InteractionContext.getSubcommandGroup(),
        subcommand: InteractionContext.getSubcommand(),
      }),
      Effect.flatMap(({ subcommandGroup, subcommand }) =>
        pipe(
          subcommandGroup,
          Option.flatMap((group) =>
            InteractionHandlerMap.get(group)(handler.subcommandGroupHandlerMap),
          ),
          Option.map((ctx) => ctx.handler),
          Option.orElse(() =>
            pipe(
              subcommand,
              Option.flatMap((subcommand) =>
                InteractionHandlerMap.get(subcommand)(
                  handler.subcommandHandlerMap,
                ),
              ),
              Option.map((ctx) => ctx.handler),
            ),
          ),
          Option.getOrElse<InteractionHandler<void, never, never>>(
            () => Effect.void,
          ),
        ),
      ),
    );
  }
}
