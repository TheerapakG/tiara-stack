class GASPolyfillError extends Error {
  constructor(feature: string) {
    super(`${feature} is not supported in Google Apps Script`);
    this.name = "GASPolyfillError";
  }
}

const setTimeout = () => {
  throw new GASPolyfillError("setTimeout");
};

const clearTimeout = () => {
  throw new GASPolyfillError("clearTimeout");
};

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

class URL {
  constructor() {
    throw new GASPolyfillError("URL");
  }
}

class URLSearchParams {
  constructor() {
    throw new GASPolyfillError("URLSearchParams");
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

// @ts-expect-error polyfill
globalThis.setTimeout = setTimeout;

globalThis.clearTimeout = clearTimeout;

// @ts-expect-error polyfill
globalThis.TextEncoder = TextEncoder;

// @ts-expect-error polyfill
globalThis.TextDecoder = TextDecoder;

// @ts-expect-error polyfill
globalThis.URL = URL;

// @ts-expect-error polyfill
globalThis.URLSearchParams = URLSearchParams;

// @ts-expect-error polyfill
globalThis.Blob = Blob;

// @ts-expect-error polyfill
globalThis.FormData = FormData;

// @ts-expect-error polyfill
globalThis.Headers = Headers;

// @ts-expect-error polyfill
globalThis.Request = Request;

// @ts-expect-error polyfill
globalThis.Response = Response;

export {};
