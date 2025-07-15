import "core-js/modules/web.immediate";
import "core-js/modules/web.timers";
import "core-js/modules/web.url";
import "core-js/modules/web.url-search-params";

class GASPolyfillError extends Error {
  constructor(feature: string) {
    super(`${feature} is not supported in Google Apps Script`);
    this.name = "GASPolyfillError";
  }
}

class TextEncoder {
  readonly encoding = "utf-8";

  encode(str: string) {
    return new Uint8Array(Utilities.newBlob(str).getBytes());
  }

  encodeInto() {
    throw new GASPolyfillError("encodeInto");
  }
}

class TextDecoder {
  decode(buffer: Uint8Array) {
    return Utilities.newBlob(Array.from(buffer)).getDataAsString();
  }
}

class Blob {
  constructor() {
    throw new GASPolyfillError("Blob");
  }
}

class FormData {
  constructor() {
    throw new GASPolyfillError("FormData");
  }
}

class Headers {
  constructor() {
    throw new GASPolyfillError("Headers");
  }
}

class Request {
  constructor() {
    throw new GASPolyfillError("Request");
  }
}

class Response {
  constructor() {
    throw new GASPolyfillError("Response");
  }
}

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
globalThis.TextEncoder = TextEncoder;

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
globalThis.TextDecoder = TextDecoder;

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
globalThis.URL = URL;

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
globalThis.URLSearchParams = URLSearchParams;

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
globalThis.Blob = Blob;

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
globalThis.FormData = FormData;

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
globalThis.Headers = Headers;

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
globalThis.Request = Request;

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
globalThis.Response = Response;

export {};
