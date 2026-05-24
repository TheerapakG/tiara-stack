import { StatusRpcs } from "sheet-ingress-api/sheet-apis-rpc";
import { Effect, Layer } from "effect";
import { ServiceStatusService } from "@/services";

export const statusLayer = StatusRpcs.toLayer(
  Effect.gen(function* () {
    const serviceStatusService = yield* ServiceStatusService;

    return {
      "status.getServices": () => serviceStatusService.getServicesStatus(),
    };
  }),
).pipe(Layer.provide(ServiceStatusService.layer));
