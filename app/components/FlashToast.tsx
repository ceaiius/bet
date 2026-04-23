import { useEffect, useState } from "react";

/**
 * <FlashToast />
 *
 * One-shot notification driven by `session.flash()` in auth.server.ts.
 * Mounts when a flash message is in loaderData, fades out after ~4s.
 *
 * Critical detail: the shell mounts this with `key={flash}`. When the
 * flash string changes, React unmounts and remounts the component,
 * resetting the fade timer. Without that key, back-to-back flashes
 * (login then immediate register, etc.) would sometimes not re-show.
 */
export function FlashToast({ message }: { message: string }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        "pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2",
        "rounded-full border border-emerald-400/40 bg-emerald-500/20 px-4 py-2",
        "text-sm text-emerald-100 shadow-lg backdrop-blur",
        "transition-opacity duration-500",
        visible ? "opacity-100" : "opacity-0",
      ].join(" ")}
    >
      {message}
    </div>
  );
}
