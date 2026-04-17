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
