"use client";

import { useEffect } from "react";
import type { ViewerActions } from "@/types";

interface UseKeyboardNavOptions {
  actions: ViewerActions;
  enabled?: boolean;
}

export function useKeyboardNav({
  actions,
  enabled = true,
}: UseKeyboardNavOptions): void {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          actions.goPrevious();
          break;
        case "ArrowRight":
          e.preventDefault();
          actions.goNext();
          break;
        case "ArrowUp":
          e.preventDefault();
          // Look up
          actions.setCamera({ pitch: 10 });
          break;
        case "ArrowDown":
          e.preventDefault();
          // Look down
          actions.setCamera({ pitch: -10 });
          break;
        case "+":
        case "=":
          e.preventDefault();
          // Zoom in (decrease FOV)
          actions.setCamera({ fov: -10 });
          break;
        case "-":
        case "_":
          e.preventDefault();
          // Zoom out (increase FOV)
          actions.setCamera({ fov: 10 });
          break;
        case "Home":
          e.preventDefault();
          actions.goToIndex(0);
          break;
        case "End":
          e.preventDefault();
          actions.goToDistance(Infinity);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [actions, enabled]);
}
