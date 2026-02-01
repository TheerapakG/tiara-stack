import {
  Cookies,
  HttpClient,
  HttpClientError,
  HttpClientRequest,
  HttpClientResponse,
  HttpIncomingMessage,
  Headers,
  UrlParams,
} from "@effect/platform";
import { Context, Effect, pipe, Layer, Option, Stream, Inspectable, Record } from "effect";

export const AppsScriptHttpClientTypeId = Symbol.for(
  "@effect/platform-apps-script/AppsScriptHttpClient",
);
export const AppsScriptHttpClient = Context.GenericTag(
  "@effect/platform-apps-script/AppsScriptHttpClient",
);

interface AppsScriptHttpRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: Uint8Array | undefined;
}

class HttpIncomingMessageImpl
  extends Inspectable.Class
  implements HttpIncomingMessage.HttpIncomingMessage<HttpClientError.ResponseError>
{
  source: GoogleAppsScript.URL_Fetch.HTTPResponse;
  onError: (cause: unknown) => HttpClientError.ResponseError;
  remoteAddressOverride?: string;
  [HttpIncomingMessage.TypeId]: typeof HttpIncomingMessage.TypeId;

  constructor(
    source: GoogleAppsScript.URL_Fetch.HTTPResponse,
    onError: (cause: unknown) => HttpClientError.ResponseError,
    remoteAddressOverride?: string,
  ) {
    super();
    this.source = source;
    this.onError = onError;
    this.remoteAddressOverride = remoteAddressOverride;
    this[HttpIncomingMessage.TypeId] = HttpIncomingMessage.TypeId;
  }

  get headers(): Headers.Headers {
    const headerArray = this.source.getAllHeaders() as Record<string, string | string[]>;
    const headers: Record<string, string | string[]> = {};
    for (const key in headerArray) {
      const value = headerArray[key];
      if (value !== undefined) {
        headers[key] = value;
      }
    }
    return Headers.fromInput(headers);
  }

  get remoteAddress(): Option.Option<string> {
    return Option.fromNullable(this.remoteAddressOverride);
  }

  private cachedText: Effect.Effect<string, HttpClientError.ResponseError> | undefined;
  get text(): Effect.Effect<string, HttpClientError.ResponseError> {
    if (this.cachedText) {
      return this.cachedText;
    }
    this.cachedText = Effect.try({
      try: () => {
        const content = this.source.getContent();
        const uint8Array = Uint8Array.from(content);
        return new TextDecoder().decode(uint8Array);
      },
      catch: this.onError,
    });
    return this.cachedText;
  }

  get json(): Effect.Effect<unknown, HttpClientError.ResponseError> {
    return Effect.tryMap(this.text, {
      try: (_) => (_ === "" ? null : JSON.parse(_)),
      catch: this.onError,
    });
  }

  get urlParamsBody(): Effect.Effect<UrlParams.UrlParams, HttpClientError.ResponseError> {
    return Effect.flatMap(this.text, (_) =>
      Effect.try({
        try: () => UrlParams.fromInput(new URLSearchParams(_)),
        catch: this.onError,
      }),
    );
  }

  get stream(): Stream.Stream<Uint8Array, HttpClientError.ResponseError> {
    const content = this.source.getContent();
    const uint8Array = Uint8Array.from(content);
    return Stream.fromIterable([uint8Array]);
  }

  get arrayBuffer(): Effect.Effect<ArrayBuffer, HttpClientError.ResponseError> {
    const content = this.source.getContent();
    const uint8Array = Uint8Array.from(content);
    return Effect.succeed(uint8Array.buffer);
  }

  toJSON(): object {
    return HttpIncomingMessage.inspect(this, {
      _id: "@effect/platform/HttpIncomingMessage",
    });
  }
}

class ClientResponseImpl
  extends HttpIncomingMessageImpl
  implements HttpClientResponse.HttpClientResponse
{
  request: HttpClientRequest.HttpClientRequest;
  [HttpClientResponse.TypeId]: typeof HttpClientResponse.TypeId;

  constructor(
    request: HttpClientRequest.HttpClientRequest,
    source: GoogleAppsScript.URL_Fetch.HTTPResponse,
  ) {
    super(
      source,
      (cause) =>
        new HttpClientError.ResponseError({
          request,
          response: this,
          reason: "Decode" as const,
          cause,
        }),
    );
    this.request = request;
    this[HttpClientResponse.TypeId] = HttpClientResponse.TypeId;
  }

  get status(): number {
    return this.source.getResponseCode();
  }

  private cachedCookies: Cookies.Cookies | undefined;
  get cookies(): Cookies.Cookies {
    if (this.cachedCookies !== undefined) {
      return this.cachedCookies;
    }
    const headerArray = this.source.getAllHeaders() as Record<string, string | string[]>;
    const header = headerArray["set-cookie"];
    if (Array.isArray(header)) {
      return (this.cachedCookies = Cookies.fromSetCookie(header));
    }
    return (this.cachedCookies = Cookies.empty);
  }

  get formData(): Effect.Effect<FormData, HttpClientError.ResponseError> {
    return Effect.tryPromise({
      try: async (_signal) => {
        const headers = new globalThis.Headers();
        const headerArray = this.source.getAllHeaders() as Record<string, string | string[]>;
        for (const key in headerArray) {
          const value = headerArray[key];
          if (value !== undefined) {
            if (Array.isArray(value)) {
              value.forEach((v) => headers.append(key, v));
            } else {
              headers.append(key, value);
            }
          }
        }
        const init: ResponseInit = {
          headers,
        };
        if (this.source.getResponseCode()) {
          init.status = this.source.getResponseCode();
        }
        const content = this.source.getContent();
        const uint8Array = Uint8Array.from(content);
        return new Response(
          new Blob([uint8Array.buffer], {
            type: headers.get("content-type") || undefined,
          }),
          init,
        ).formData();
      },
      catch: this.onError,
    });
  }

  override toJSON(): object {
    return HttpIncomingMessage.inspect(this, {
      _id: "@effect/platform/HttpClientResponse",
      request: this.request.toJSON(),
      status: this.status,
    });
  }
}

const makeAppsScriptHttpRequest = HttpClient.make((request, _url, _signal) => {
  const urlString = typeof _url === "string" ? _url : _url.toString();

  const headersObj: Record<string, string> = {};
  for (const key in request.headers) {
    headersObj[key] = request.headers[key];
  }

  const httpRequest: AppsScriptHttpRequest = {
    method: request.method,
    url: urlString,
    headers: headersObj,
    body: undefined,
  };

  return pipe(
    Effect.suspend(() => sendBody(request, httpRequest)),
    Effect.flatMap(() => waitForResponse(request, httpRequest)),
    Effect.map((response) => new ClientResponseImpl(request, response)),
  );
});

const sendBody = (
  request: HttpClientRequest.HttpClientRequest,
  httpRequest: AppsScriptHttpRequest,
): Effect.Effect<void, HttpClientError.HttpClientError> => {
  const body = request.body;
  switch (body._tag) {
    case "Empty": {
      httpRequest.body = new Uint8Array(0);
      return Effect.void;
    }
    case "Uint8Array": {
      httpRequest.body = body.body;
      return Effect.void;
    }
    case "Raw": {
      if (body.body instanceof Uint8Array) {
        httpRequest.body = body.body;
      } else if (typeof body.body === "string") {
        httpRequest.body = new TextEncoder().encode(body.body);
      } else {
        httpRequest.body = new Uint8Array(0);
      }
      return Effect.void;
    }
    case "FormData": {
      return Effect.try({
        try: () => {
          throw new Error("FormData not supported in Apps Script");
        },
        catch: (cause) =>
          new HttpClientError.RequestError({
            request,
            reason: "Encode" as const,
            cause,
          }),
      });
    }
    case "Stream": {
      return Effect.try({
        try: () => {
          throw new Error("Stream body not supported in Apps Script");
        },
        catch: (cause) =>
          new HttpClientError.RequestError({
            request,
            reason: "Encode" as const,
            cause,
          }),
      });
    }
  }
};

const waitForResponse = (
  request: HttpClientRequest.HttpClientRequest,
  httpRequest: AppsScriptHttpRequest,
): Effect.Effect<GoogleAppsScript.URL_Fetch.HTTPResponse, HttpClientError.HttpClientError> => {
  return Effect.try({
    try: () => {
      const method = httpRequest.method.toLowerCase();
      const validMethods = ["get", "post", "put", "delete", "patch"] as const;
      const isValidMethod = (m: string): m is "get" | "post" | "put" | "delete" | "patch" =>
        validMethods.includes(m as "get" | "post" | "put" | "delete" | "patch");
      const validMethod = isValidMethod(method) ? method : "get";

      const headers = Record.remove(httpRequest.headers, "content-length");

      const options: GoogleAppsScript.URL_Fetch.URLFetchRequest = {
        url: httpRequest.url,
        method: validMethod,
        headers,
        payload: httpRequest.body,
      };

      return UrlFetchApp.fetch(httpRequest.url, options);
    },
    catch: (cause: unknown) =>
      new HttpClientError.RequestError({
        request,
        reason: "Transport" as const,
        cause,
      }),
  });
};

export const layer: Layer.Layer<HttpClient.HttpClient, never, never> =
  HttpClient.layerMergedContext(Effect.succeed(makeAppsScriptHttpRequest));
