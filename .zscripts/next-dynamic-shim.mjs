// next/dynamic shim: immediately render the loaded component (sync-ish).
import React from "react";

export default function dynamic(loader, opts) {
  const Lazy = React.lazy(() =>
    Promise.resolve(loader()).then((m) => (m && typeof m === "object" && "default" in m ? m : { default: m })),
  );
  return function DynamicShim(props) {
    return React.createElement(
      React.Suspense,
      { fallback: opts && opts.loading ? React.createElement(opts.loading) : null },
      React.createElement(Lazy, props),
    );
  };
}
