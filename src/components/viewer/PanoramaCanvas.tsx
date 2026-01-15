"use client";

import { useRef, useEffect, useCallback } from "react";
import { ReactPhotoSphereViewer } from "react-photo-sphere-viewer";
import { MarkersPlugin } from "@photo-sphere-viewer/markers-plugin";
import type { Viewer } from "@photo-sphere-viewer/core";

// SVG arrow pointing forward (up direction in screen space, will be placed looking down at floor)
const ARROW_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="60" height="60">
  <defs>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <polygon points="50,15 85,85 50,65 15,85" fill="white" stroke="rgba(255,107,107,0.8)" stroke-width="3" filter="url(#glow)"/>
</svg>`;

// Reverse arrow (pointing backward)
const ARROW_SVG_BACK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="60" height="60">
  <defs>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <polygon points="50,85 85,15 50,35 15,15" fill="white" stroke="rgba(255,107,107,0.8)" stroke-width="3" filter="url(#glow)"/>
</svg>`;

interface PanoramaCanvasProps {
  imageUrl: string | null;
  heading: number;
  nextHeading: number | null;
  prevHeading: number | null;
  defaultYaw: number;
  defaultPitch: number;
  onCameraChange: (camera: { yaw?: number; pitch?: number }) => void;
  onNavigate: (direction: "next" | "prev") => void;
  isLoading?: boolean;
}

// Convert degrees to radians
function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

// Convert radians to degrees (normalized 0-360)
function radToDeg(rad: number): number {
  const deg = (rad * 180) / Math.PI;
  return ((deg % 360) + 360) % 360;
}

export function PanoramaCanvas({
  imageUrl,
  heading,
  nextHeading,
  prevHeading,
  defaultYaw,
  defaultPitch,
  onCameraChange,
  onNavigate,
  isLoading = false,
}: PanoramaCanvasProps) {
  const viewerRef = useRef<Viewer | null>(null);
  const markersPluginRef = useRef<InstanceType<typeof MarkersPlugin> | null>(null);
  const lastImageUrlRef = useRef<string | null>(null);
  const isFirstLoadRef = useRef(true);
  const lastReportedYawRef = useRef<number | null>(null);
  const lastReportedPitchRef = useRef<number | null>(null);

  // Handle viewer ready
  const handleReady = useCallback(
    (instance: Viewer) => {
      viewerRef.current = instance;
      markersPluginRef.current = instance.getPlugin(MarkersPlugin) as InstanceType<typeof MarkersPlugin>;

      // Listen for position updates (camera changes)
      instance.addEventListener("position-updated", (e) => {
        const yaw = radToDeg(e.position.yaw);
        const pitch = (e.position.pitch * 180) / Math.PI;

        // Debounce: only report if changed significantly
        const yawDiff = lastReportedYawRef.current !== null ? Math.abs(yaw - lastReportedYawRef.current) : 999;
        const pitchDiff = lastReportedPitchRef.current !== null ? Math.abs(pitch - lastReportedPitchRef.current) : 999;

        if (yawDiff > 0.5 || pitchDiff > 0.5) {
          lastReportedYawRef.current = yaw;
          lastReportedPitchRef.current = pitch;
          onCameraChange({ yaw, pitch });
        }
      });

      // Listen for marker clicks
      instance.addEventListener("click", (e) => {
        if (e.data?.marker) {
          const markerId = e.data.marker.id;
          if (markerId === "nav-next") {
            onNavigate("next");
          } else if (markerId === "nav-prev") {
            onNavigate("prev");
          }
        }
      });
    },
    [onCameraChange, onNavigate]
  );

  // Update markers when heading info changes
  useEffect(() => {
    const markers = markersPluginRef.current;
    if (!markers) return;

    // Clear existing markers
    markers.clearMarkers();

    // Add next arrow marker
    if (nextHeading !== null) {
      markers.addMarker({
        id: "nav-next",
        position: { yaw: degToRad(nextHeading), pitch: degToRad(-15) },
        html: ARROW_SVG,
        anchor: "center center",
        tooltip: "Go forward",
        data: { direction: "next" },
      });
    }

    // Add prev arrow marker
    if (prevHeading !== null) {
      markers.addMarker({
        id: "nav-prev",
        position: { yaw: degToRad(prevHeading), pitch: degToRad(-15) },
        html: ARROW_SVG_BACK,
        anchor: "center center",
        tooltip: "Go back",
        data: { direction: "prev" },
      });
    }
  }, [nextHeading, prevHeading]);

  // Handle image URL changes - update panorama without resetting camera
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !imageUrl) return;

    // Skip if URL hasn't changed
    if (imageUrl === lastImageUrlRef.current) return;
    lastImageUrlRef.current = imageUrl;

    // Update sphere correction for the new image's heading
    // This ensures yaw: 0 always points North
    viewer.setOption("sphereCorrection", { pan: degToRad(heading) });

    // If this is not the first load, change panorama while preserving camera position
    if (!isFirstLoadRef.current) {
      viewer.setPanorama(imageUrl, {
        transition: false,
        showLoader: false,
      });
    } else {
      isFirstLoadRef.current = false;
    }
  }, [imageUrl, heading]);

  // Don't render until we have an image URL
  if (!imageUrl) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-slate-950">
        <div className="w-8 h-8 border-2 border-coral border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="absolute inset-0">
      <ReactPhotoSphereViewer
        src={imageUrl}
        height="100vh"
        width="100%"
        container=""
        onReady={handleReady}
        defaultYaw={degToRad(defaultYaw)}
        defaultPitch={degToRad(defaultPitch)}
        sphereCorrection={{ pan: degToRad(heading) }}
        navbar={false}
        plugins={[
          [
            MarkersPlugin,
            {
              markers: [],
            },
          ],
        ]}
        loadingTxt=""
        touchmoveTwoFingers={false}
        mousewheelCtrlKey={false}
        moveSpeed={1.5}
      />

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/50 pointer-events-none">
          <div className="w-8 h-8 border-2 border-coral border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
