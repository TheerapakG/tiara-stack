import { Fragment } from "react";
import { RegistryContext } from "@effect-atom/atom-react";
import { setupStartAtomCoreIntegration } from "./start-atom-core.js";
import type { StartAtomOptions } from "./start-atom-core.js";
import type { AnyRouter } from "@tanstack/react-router";

export type { StartAtomOptions };

export type Options<TRouter extends AnyRouter> = StartAtomOptions<TRouter> & {
  wrapRegistry?: boolean;
};

export function setupStartAtomIntegration<TRouter extends AnyRouter>(opts: Options<TRouter>) {
  setupStartAtomCoreIntegration(opts);

  if (opts.wrapRegistry === false) {
    return;
  }

  const OGWrap = opts.router.options.Wrap || Fragment;

  opts.router.options.Wrap = ({ children }) => {
    return (
      <RegistryContext.Provider value={opts.registry}>
        <OGWrap>{children}</OGWrap>
      </RegistryContext.Provider>
    );
  };
}

export { setupStartAtomCoreIntegration };
