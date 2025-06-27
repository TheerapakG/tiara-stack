import { Client, Events, GatewayIntentBits } from "discord.js";
import { Effect, pipe } from "effect";

export class Bot {
  private client: Client;
  private loginLatch: Effect.Latch;
  private loginSemaphore: Effect.Semaphore;

  constructor(
    client: Client,
    loginLatch: Effect.Latch,
    loginSemaphore: Effect.Semaphore,
  ) {
    this.client = client;
    this.loginLatch = loginLatch;
    this.loginSemaphore = loginSemaphore;
  }

  static create() {
    return pipe(
      Effect.Do,
      Effect.let(
        "client",
        () => new Client({ intents: [GatewayIntentBits.Guilds] }),
      ),
      Effect.tap(({ client }) => client.once(Events.ClientReady, () => {})),
      Effect.bind("loginLatch", () => Effect.makeLatch(false)),
      Effect.bind("loginSemaphore", () => Effect.makeSemaphore(1)),
      Effect.let(
        "bot",
        ({ client, loginLatch, loginSemaphore }) =>
          new Bot(client, loginLatch, loginSemaphore),
      ),
      Effect.map(({ bot }) => bot),
    );
  }

  static login(token: string) {
    return (bot: Bot) =>
      pipe(
        Effect.promise(() => bot.client.login(token)),
        Effect.andThen(() => bot.loginLatch.await),
        Effect.as(bot),
        bot.loginSemaphore.withPermits(1),
      );
  }

  static destroy(bot: Bot) {
    return pipe(
      Effect.promise(() => bot.client.destroy()),
      Effect.andThen(() => bot.loginLatch.release),
      Effect.as(bot),
    );
  }
}
