export function focusHeadingById(id: string) {
  const target = document.getElementById(id);
  if (!target) {
    return false;
  }

  if (!target.hasAttribute("tabindex")) {
    target.setAttribute("tabindex", "-1");
  }

  history.replaceState(null, "", `#${encodeURIComponent(id)}`);
  target.scrollIntoView({ behavior: "smooth", block: "start" });
  target.focus({ preventScroll: true });

  return true;
}

export function focusHeadingByIdWhenReady(id: string, timeoutMs = 1500) {
  const startedAt = performance.now();

  return new Promise<boolean>((resolve) => {
    const tryFocus = () => {
      if (focusHeadingById(id)) {
        resolve(true);
        return;
      }

      if (performance.now() - startedAt >= timeoutMs) {
        resolve(false);
        return;
      }

      window.requestAnimationFrame(tryFocus);
    };

    window.requestAnimationFrame(tryFocus);
  });
}
