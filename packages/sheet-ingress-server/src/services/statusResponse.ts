import type { ServicesStatusResponse } from "sheet-ingress-api/sheet-apis-rpc";

export const normalizeServicesStatusResponse = (
  response: ServicesStatusResponse,
): ServicesStatusResponse => ({
  ...response,
  services: response.services.map((service) => ({
    ...service,
    error: service.error ?? null,
  })),
});
