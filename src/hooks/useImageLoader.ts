"use client";

import { useState, useEffect, useRef } from "react";
import type { ImageTier } from "@/types";
import { getImageUrl, preloadImage } from "@/lib/imageUrl";
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

// Track URLs that have been successfully loaded (persists across component re-renders)
const loadedUrlsCache = new Set<string>();

export function useImageLoader({
  raceSlug,
  currentIndex,
  totalImages,
  enabled = true,
}: UseImageLoaderOptions): UseImageLoaderReturn {
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [loadedTier, setLoadedTier] = useState<ImageTier>("thumbnail");
  const [isLoading, setIsLoading] = useState(true);
  const [preloadProgress, setPreloadProgress] = useState(0);

  // Always use WebP format
  const format = "webp";

  // Track preloaded images for adjacent preloading
  const preloadedRef = useRef<Set<string>>(new Set());
  const currentIndexRef = useRef(currentIndex);

  // Load current image with progressive quality (or instant if cached)
  useEffect(() => {
    if (!enabled || currentIndex < 0) {
      setIsLoading(false);
      return;
    }
    currentIndexRef.current = currentIndex;

    const fullUrl = getImageUrl(raceSlug, "full", currentIndex, format);
    const mediumUrl = getImageUrl(raceSlug, "medium", currentIndex, format);
    const thumbUrl = getImageUrl(raceSlug, "thumbnail", currentIndex, format);

    // Check if higher quality versions are already cached
    if (loadedUrlsCache.has(fullUrl)) {
      // Full image already loaded - use it instantly
      setCurrentImageUrl(fullUrl);
      setLoadedTier("full");
      setIsLoading(false);
      return;
    }

    if (loadedUrlsCache.has(mediumUrl)) {
      // Medium image cached - use it instantly, then upgrade to full
      setCurrentImageUrl(mediumUrl);
      setLoadedTier("medium");
      setIsLoading(false);

      // Try to upgrade to full in background
      preloadImage(fullUrl)
        .then(() => {
          if (currentIndexRef.current !== currentIndex) return;
          loadedUrlsCache.add(fullUrl);
          setCurrentImageUrl(fullUrl);
          setLoadedTier("full");
        })
        .catch(() => {
          // Stay on medium
        });
      return;
    }

    // No cached version - do progressive loading
    setIsLoading(true);
    setLoadedTier("thumbnail");

    const loadSequence = async () => {
      // 1. Load thumbnail first (fast)
      try {
        await preloadImage(thumbUrl);
        if (currentIndexRef.current !== currentIndex) return;
        loadedUrlsCache.add(thumbUrl);
        setCurrentImageUrl(thumbUrl);
        setLoadedTier("thumbnail");
        setIsLoading(false);
      } catch (err) {
        console.error("Failed to load thumbnail:", thumbUrl, err);
      }

      // 2. Load medium quality after short delay
      await new Promise((resolve) =>
        setTimeout(resolve, PRELOAD_SETTINGS.upgradeDelayMs)
      );
      if (currentIndexRef.current !== currentIndex) return;

      try {
        await preloadImage(mediumUrl);
        if (currentIndexRef.current !== currentIndex) return;
        loadedUrlsCache.add(mediumUrl);
        setCurrentImageUrl(mediumUrl);
        setLoadedTier("medium");
      } catch {
        console.error("Failed to load medium:", mediumUrl);
      }

      // 3. Load full high quality after longer delay
      await new Promise((resolve) =>
        setTimeout(resolve, PRELOAD_SETTINGS.fullUpgradeDelayMs)
      );
      if (currentIndexRef.current !== currentIndex) return;

      try {
        await preloadImage(fullUrl);
        if (currentIndexRef.current !== currentIndex) return;
        loadedUrlsCache.add(fullUrl);
        setCurrentImageUrl(fullUrl);
        setLoadedTier("full");
      } catch {
        // Fallback to medium is already active, so we just log the error
        console.warn("Failed to load full resolution image:", fullUrl);
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
            loadedUrlsCache.add(thumbUrl);
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
