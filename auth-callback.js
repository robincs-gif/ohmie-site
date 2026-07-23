(() => {
  "use strict";

  const page = document.querySelector("[data-ohmie-auth-callback]");
  const button = document.querySelector("[data-open-ohmie]");
  const kicker = document.querySelector("[data-callback-kicker]");
  const title = document.querySelector("[data-callback-title]");
  const message = document.querySelector("[data-callback-message]");
  const help = document.querySelector("[data-callback-help]");
  if (!page || !button || !kicker || !title || !message || !help) return;

  const kind = page.getAttribute("data-ohmie-auth-callback");
  if (kind !== "email" && kind !== "reset") return;

  const query = new URLSearchParams(window.location.search);
  const fragment = new URLSearchParams(window.location.hash.slice(1));
  const hasError = query.has("error") || fragment.has("error");
  const hasPKCECode = Boolean(query.get("code"));
  const hasImplicitSession = Boolean(
    fragment.get("access_token") && fragment.get("refresh_token")
  );

  if (hasError || (!hasPKCECode && !hasImplicitSession)) {
    kicker.textContent = "Link unavailable";
    title.textContent = "This link can’t be used";
    message.textContent = hasError
      ? "This link expired, was already used, or was rejected. Return to Ohmie and request a new one."
      : "This link is incomplete. Return to Ohmie and request a new email.";
    help.hidden = true;
    button.hidden = true;
    return;
  }

  kicker.textContent = kind === "email" ? "Email confirmed" : "Reset link verified";
  title.textContent = kind === "email"
    ? "Finish in Ohmie"
    : "Choose your new password in Ohmie";
  message.textContent = kind === "email"
    ? "Tap below to return to Ohmie and finish signing in."
    : "Tap below to return to Ohmie and choose a new password.";

  const target = new URL(`ohmie://auth/${kind}`);
  target.search = window.location.search;
  target.hash = window.location.hash;

  button.href = target.toString();
  button.hidden = false;
  button.removeAttribute("aria-disabled");
  help.hidden = false;
})();
