import { Redacted } from "effect";

export const decodeBearerCredential = (credential: Redacted.Redacted<string>) => {
  const token = Redacted.value(credential);

  try {
    return Redacted.make(decodeURIComponent(token));
  } catch {
    return credential;
  }
};
