/** Entry point. Boots the game and wires the opening moments. */

import { Game } from "./game.js";

const canvas = document.getElementById("world");

function boot() {
  const game = new Game(canvas);

  // The opening invitation: a still, quiet call before the first week begins.
  game.setSpeed(0);
  game.ui.openModal("modal-help");

  // Expose for debugging in the console without polluting globals.
  if (typeof window !== "undefined") {
    Object.defineProperty(window, "watchman", { value: game, writable: false });
  }

  document.addEventListener(
    "pointerdown",
    () => {
      // Audio needs a gesture before it will start.
      import("./audio.js").then((a) => a.resume());
    },
    { once: true }
  );

  return game;
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
