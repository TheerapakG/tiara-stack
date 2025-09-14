export const ServerSymbol = Symbol("Typhoon/Server/Server");

export class Server {
  readonly [ServerSymbol]: Server = this;
}
