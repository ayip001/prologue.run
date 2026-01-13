"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { ImageTier } from "@/types";
import { getImageUrl, supportsAvif, preloadImage } from "@/lib/imageUrl";
import { PRELOAD_SETTINGS } from "@/lib/constants";

interface UseImageLoaderOptions {
  raceSlug: string;
  currentIndex: number;
  totalImages: number;
  enabled?: boolean;
}

interface UseImageLoaderReturn {
  currentImageUrl: string | null;
  loadedTier: ImageTier;
  isLoading: boolean;
  preloadProgress: number;
}

export function useImageLoader({
  raceSlug,
  currentIndex,
  totalImages,
  enabled = true,
}: UseImageLoaderOptions): UseImageLoaderReturn {
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [loadedTier, setLoadedTier] = useState<ImageTier>("thumbnail");
  const [isLoading, setIsLoading] = useState(true);
  const [format, setFormat] = useState<"avif" | "webp">("avif");
  const [preloadProgress, setPreloadProgress] = useState(0);

  // Track preloaded images
  const preloadedRef = useRef<Set<string>>(new Set());
  const currentIndexRef = useRef(currentIndex);

  // Detect AVIF support on mount
  useEffect(() => {
    if (!enabled) return;
    supportsAvif().then((supported) => {
      setFormat(supported ? "avif" : "webp");
    });
  }, [enabled]);

  // Load current image with progressive quality
  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }
    currentIndexRef.current = currentIndex;
    setIsLoading(true);
    setLoadedTier("thumbnail");

    const loadSequence = async () => {
      // 1. Load thumbnail first (fast)
      const thumbUrl = getImageUrl(raceSlug, "thumbnail", currentIndex, format);
      try {
        await preloadImage(thumbUrl);
        if (currentIndexRef.current !== currentIndex) return;
        setCurrentImageUrl(thumbUrl);
        setLoadedTier("thumbnail");
        setIsLoading(false);
      } catch {
        console.error("Failed to load thumbnail:", thumbUrl);
      }

      // 2. Load medium quality after short delay
      await new Promise((resolve) =>
        setTimeout(resolve, PRELOAD_SETTINGS.upgradeDelayMs)
      );
      if (currentIndexRef.current !== currentIndex) return;

      const mediumUrl = getImageUrl(raceSlug, "medium", currentIndex, format);
      try {
        await preloadImage(mediumUrl);
        if (currentIndexRef.current !== currentIndex) return;
        setCurrentImageUrl(mediumUrl);
        setLoadedTier("medium");
      } catch {
        console.error("Failed to load medium:", mediumUrl);
      }
    };

    loadSequence();
  }, [raceSlug, currentIndex, format, enabled]);

  // Preload adjacent images
  useEffect(() => {
    if (!enabled) return;
    const preloadAdjacent = async () => {
      const indicesToPreload: number[] = [];

      // Ahead
      for (
        let i = 1;
        i <= PRELOAD_SETTINGS.preloadAhead && currentIndex + i < totalImages;
        i++
      ) {
        indicesToPreload.push(currentIndex + i);
      }

      // Behind
      for (
        let i = 1;
        i <= PRELOAD_SETTINGS.preloadBehind && currentIndex - i >= 0;
        i++
      ) {
        indicesToPreload.push(currentIndex - i);
      }

      let loadedCount = 0;
      const totalToLoad = indicesToPreload.length;

      for (const index of indicesToPreload) {
        const thumbUrl = getImageUrl(raceSlug, "thumbnail", index, format);

        if (!preloadedRef.current.has(thumbUrl)) {
          try {
            await preloadImage(thumbUrl);
            preloadedRef.current.add(thumbUrl);
          } catch {
            // Ignore preload errors
          }
        }

        loadedCount++;
        setPreloadProgress((loadedCount / totalToLoad) * 100);
      }
    };

    preloadAdjacent();
  }, [raceSlug, currentIndex, totalImages, format, enabled]);

  return {
    currentImageUrl,
    loadedTier,
    isLoading,
    preloadProgress,
  };
}
