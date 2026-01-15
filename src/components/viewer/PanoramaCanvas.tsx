"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { CameraState } from "@/types";
import { clampFov } from "@/lib/viewState";
import { CAMERA_CONSTRAINTS } from "@/lib/constants";

// Offset to convert between our heading (0 = forward) and OrbitControls azimuth (0 = -Z axis)
const HEADING_OFFSET = 90;

interface PanoramaCanvasProps {
  imageUrl: string | null;
  camera: CameraState;
  initialCamera: { yaw: number; pitch: number };
  onCameraChange: (camera: Partial<CameraState>) => void;
  isLoading: boolean;
}

// Error boundary fallback component
function CanvasErrorFallback({ error }: { error: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-slate-950 text-white p-4">
      <div className="text-center max-w-md">
        <p className="text-red-400 mb-2">Failed to load 3D viewer</p>
        <p className="text-slate-400 text-sm">{error}</p>
        <p className="text-slate-500 text-xs mt-2">Try refreshing the page or using a different browser.</p>
      </div>
    </div>
  );
}

// Component to debug Three.js context state
function ContextDebugger() {
  return null;
}

function PanoramaSphere({
  imageUrl,
  initialCamera,
  fov,
  onCameraChange,
}: {
  imageUrl: string | null;
  initialCamera: { yaw: number; pitch: number };
  fov: number;
  onCameraChange: (camera: Partial<CameraState>) => void;
}) {
  const { camera: threeCamera, invalidate: invalidateFrame, gl } = useThree();
  const controlsRef = useRef<any>(null);
  const textureRef = useRef<THREE.Texture | null>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  // Camera state refs
  const initialCameraRef = useRef<{ yaw: number; pitch: number }>({ yaw: initialCamera.yaw, pitch: initialCamera.pitch });
  const initialCameraAppliedRef = useRef(false);
  const suppressOnChangeRef = useRef(true);
  const prevInitialCameraRef = useRef(initialCamera);

  // Track previous imageUrl to only log on changes
  const prevImageUrlRef = useRef<string | null>(null);

  // Update initialCameraRef when prop changes significantly
  useEffect(() => {
    const prev = prevInitialCameraRef.current;
    const changed =
      Math.abs(prev.yaw - initialCamera.yaw) > 0.1 ||
      Math.abs(prev.pitch - initialCamera.pitch) > 0.1;

    if (changed && !initialCameraAppliedRef.current) {
      initialCameraRef.current = { yaw: initialCamera.yaw, pitch: initialCamera.pitch };
    }
    prevInitialCameraRef.current = initialCamera;
  }, [initialCamera.yaw, initialCamera.pitch]);

  // Load texture when URL changes
  useEffect(() => {
    // Only log when imageUrl actually changes
    if (imageUrl === prevImageUrlRef.current) return;
    prevImageUrlRef.current = imageUrl;

    if (!imageUrl) {
      return;
    }

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
      console.log("[Texture] iOS - Starting texture load:", imageUrl);
    }

    const loader = new THREE.TextureLoader();
    let cancelled = false;

    loader.load(
      imageUrl,
      (loadedTexture) => {
        if (cancelled) {
          loadedTexture.dispose();
          return;
        }

        if (isIOS) {
          const img = loadedTexture.image;
          console.log("[Texture] iOS - Loaded successfully:", {
            dimensions: img ? `${img.width}x${img.height}` : "unknown",
            url: imageUrl.split("/").slice(-2).join("/"),
          });
        }

        // Configure texture
        loadedTexture.colorSpace = THREE.SRGBColorSpace;
        loadedTexture.minFilter = THREE.LinearFilter;
        loadedTexture.magFilter = THREE.LinearFilter;

        // Dispose old texture
        if (textureRef.current && textureRef.current !== loadedTexture) {
          textureRef.current.dispose();
        }
        textureRef.current = loadedTexture;
        setTexture(loadedTexture);

        // Note: invalidateFrame is now called in a useEffect after texture state updates
        // This ensures React has re-rendered the material with the new texture before invalidating

        // Force material update and invalidate
        setTimeout(() => {
          if (materialRef.current) {
            materialRef.current.needsUpdate = true;
          }
        }, 100);
      },
      undefined,
      (error) => {
        console.error("[Texture] Load error:", error);
        if (isIOS) {
          console.error("[Texture] iOS - Error details:", {
            url: imageUrl,
            errorMessage: error instanceof Error ? error.message : String(error),
          });
        }
      }
    );

    return () => {
      cancelled = true;
    };
  }, [imageUrl, invalidateFrame, gl]);

  // Dispose texture on unmount
  useEffect(() => {
    return () => {
      if (textureRef.current) {
        textureRef.current.dispose();
        textureRef.current = null;
      }
    };
  }, []);

  // Invalidate frame AFTER texture state updates (not synchronously in the loader callback)
  // This ensures R3F re-renders after React has updated the material with the new texture
  useEffect(() => {
    if (texture) {
      // Force material to update
      if (materialRef.current) {
        materialRef.current.needsUpdate = true;
      }
      invalidateFrame();
    }
  }, [texture, invalidateFrame]);

  // Update camera FOV
  useEffect(() => {
    if (threeCamera instanceof THREE.PerspectiveCamera) {
      threeCamera.fov = fov;
      threeCamera.updateProjectionMatrix();
    }
  }, [fov, threeCamera]);

  // Apply initial camera - only log once
  const hasLoggedInitialCameraRef = useRef(false);
  useFrame(() => {
    if (initialCameraAppliedRef.current) return;
    if (!controlsRef.current) return;

    const controls = controlsRef.current;
    const { yaw, pitch } = initialCameraRef.current;

    const azimuthRad = THREE.MathUtils.degToRad(yaw + HEADING_OFFSET);
    const polarRad = THREE.MathUtils.degToRad(90 - pitch);

    const wasDamping = controls.enableDamping;
    controls.enableDamping = false;
    controls.setAzimuthalAngle(azimuthRad);
    controls.setPolarAngle(polarRad);
    controls.update();
    controls.enableDamping = wasDamping;

    initialCameraAppliedRef.current = true;

    setTimeout(() => {
      suppressOnChangeRef.current = false;
      if (controlsRef.current) {
        const currentAzimuth = THREE.MathUtils.radToDeg(controlsRef.current.getAzimuthalAngle());
        const currentPolar = THREE.MathUtils.radToDeg(controlsRef.current.getPolarAngle());
        const heading = ((currentAzimuth - HEADING_OFFSET) % 360 + 360) % 360;
        const finalPitch = 90 - currentPolar;
        onCameraChange({ yaw: heading, pitch: finalPitch });
      }
    }, 50);
  });

  // Handle camera changes from controls - no logging
  const handleControlsChange = useCallback(() => {
    if (!controlsRef.current || suppressOnChangeRef.current) return;

    const controls = controlsRef.current;
    const azimuth = THREE.MathUtils.radToDeg(controls.getAzimuthalAngle());
    const polar = THREE.MathUtils.radToDeg(controls.getPolarAngle());
    const pitch = 90 - polar;
    const heading = ((azimuth - HEADING_OFFSET) % 360 + 360) % 360;

    onCameraChange({ yaw: heading, pitch });
  }, [onCameraChange]);

  // Handle zoom via scroll wheel
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      // Prevent default to stop page scrolling
      e.preventDefault();

      // Use sensitivity from constants
      const newFov = clampFov(fov + e.deltaY * CAMERA_CONSTRAINTS.zoomSensitivity);

      if (Math.abs(newFov - fov) > 0.1) {
        onCameraChange({ fov: newFov });
      }
    };

    const element = gl.domElement;
    element.addEventListener("wheel", handleWheel, { passive: false });
    return () => element.removeEventListener("wheel", handleWheel);
  }, [fov, onCameraChange, gl]);

  // Handle touch gestures (double tap)
  useEffect(() => {
    const element = gl.domElement;
    let lastTapTime = 0;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const now = Date.now();
        const timespan = now - lastTapTime;
        if (timespan > 0 && timespan < CAMERA_CONSTRAINTS.doubleTapDelayMs) {
          // Double tap detected
          e.preventDefault();
          e.stopImmediatePropagation();
          const targetFov =
            Math.abs(fov - CAMERA_CONSTRAINTS.minFov) < 1
              ? CAMERA_CONSTRAINTS.maxFov
              : CAMERA_CONSTRAINTS.minFov;
          onCameraChange({ fov: targetFov });
          lastTapTime = 0; // Reset to avoid triple-tap issues
        } else {
          lastTapTime = now;
        }
      }
    };

    // Use capture: true to intercept events before OrbitControls for double tap
    element.addEventListener("touchstart", handleTouchStart, { capture: true, passive: false });

    return () => {
      element.removeEventListener("touchstart", handleTouchStart, { capture: true });
    };
  }, [fov, onCameraChange, gl]);

  return (
    <>
      <ContextDebugger />
      {/* Sky sphere with panorama texture */}
      <mesh ref={meshRef} scale={[-1, 1, 1]}>
        <sphereGeometry args={[500, 64, 32]} />
        <meshBasicMaterial
          ref={materialRef}
          map={texture}
          color={texture ? 0xffffff : 0x0a0f1a}
          side={THREE.BackSide}
          toneMapped={false}
        />
      </mesh>

      {/* Camera controls */}
      <OrbitControls
        ref={controlsRef}
        enableZoom={false}
        enablePan={false}
        enableDamping={false}
        rotateSpeed={-0.5}
        zoomSpeed={0.5}
        minDistance={0.1}
        maxDistance={100}
        minPolarAngle={Math.PI * 0.1}
        maxPolarAngle={Math.PI * 0.9}
        onChange={handleControlsChange}
      />
    </>
  );
}

export function PanoramaCanvas({
  imageUrl,
  camera,
  initialCamera,
  onCameraChange,
  isLoading,
}: PanoramaCanvasProps) {
  const [canvasError, setCanvasError] = useState<string | null>(null);
  const [canvasReady, setCanvasReady] = useState(false);

  // Log on iOS for debugging
  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
      console.log("[PanoramaCanvas] iOS device detected");
      console.log("[PanoramaCanvas] imageUrl:", imageUrl);
      console.log("[PanoramaCanvas] WebGL support:", !!document.createElement("canvas").getContext("webgl2"));
    }
  }, [imageUrl]);

  // Show error fallback if Canvas failed
  if (canvasError) {
    return <CanvasErrorFallback error={canvasError} />;
  }

  return (
    <div className="absolute inset-0 overflow-hidden touch-none bg-slate-950">
      <Canvas
        frameloop="always"
        camera={{
          fov: camera.fov,
          near: 0.1,
          far: 1000,
          position: [0, 0, 0.1],
        }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
          // iOS-specific: ensure we don't exceed device limits
          preserveDrawingBuffer: true,
        }}
        onCreated={({ gl }) => {
          console.log("[Canvas] Created successfully, max texture size:", gl.capabilities.maxTextureSize);
          setCanvasReady(true);
        }}
        onError={(error) => {
          console.error("[Canvas] Error:", error);
          setCanvasError(error?.message || "Unknown error creating WebGL context");
        }}
      >
        <color attach="background" args={["#0a0f1a"]} />
        <PanoramaSphere
          imageUrl={imageUrl}
          initialCamera={initialCamera}
          fov={camera.fov}
          onCameraChange={onCameraChange}
        />
      </Canvas>

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/50 pointer-events-none">
          <div className="w-8 h-8 border-2 border-coral border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
