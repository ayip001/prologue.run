"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { CameraState } from "@/types";

// Offset to convert between our heading (0 = forward) and OrbitControls azimuth (0 = -Z axis)
// Our panoramas expect 0 degrees to point forward (direction of travel)
const HEADING_OFFSET = 90;

interface PanoramaCanvasProps {
  imageUrl: string | null;
  camera: CameraState;
  onCameraChange: (camera: Partial<CameraState>) => void;
  isLoading: boolean;
}

function PanoramaSphere({
  imageUrl,
  camera,
  onCameraChange,
}: {
  imageUrl: string | null;
  camera: CameraState;
  onCameraChange: (camera: Partial<CameraState>) => void;
}) {
  const { camera: threeCamera, invalidate: invalidateFrame } = useThree();
  const controlsRef = useRef<any>(null);
  const textureRef = useRef<THREE.Texture | null>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  // Store initial camera values to apply when controls become available
  const initialCameraRef = useRef({ yaw: camera.yaw, pitch: camera.pitch });
  // Track if initial camera has been applied to controls
  const initialCameraAppliedRef = useRef(false);
  // Flag to suppress onChange during programmatic camera updates
  const suppressOnChangeRef = useRef(true);

  // Load texture when URL changes
  useEffect(() => {
    if (!imageUrl) return;

    const loader = new THREE.TextureLoader();
    let cancelled = false;

    loader.load(
      imageUrl,
      (loadedTexture) => {
        if (cancelled) {
          loadedTexture.dispose();
          return;
        }
        loadedTexture.colorSpace = THREE.SRGBColorSpace;
        loadedTexture.minFilter = THREE.LinearFilter;
        loadedTexture.magFilter = THREE.LinearFilter;
        // Dispose old texture AFTER new one is ready (not in cleanup)
        if (textureRef.current && textureRef.current !== loadedTexture) {
          textureRef.current.dispose();
        }
        textureRef.current = loadedTexture;
        setTexture(loadedTexture);
        // Force Three.js to re-render with the new texture
        invalidateFrame();
      },
      undefined,
      (error) => {
        console.error("Error loading panorama texture:", error);
      }
    );

    return () => {
      cancelled = true;
    };
  }, [imageUrl, invalidateFrame]);

  // Dispose texture on unmount
  useEffect(() => {
    return () => {
      if (textureRef.current) {
        textureRef.current.dispose();
        textureRef.current = null;
      }
    };
  }, []);

  // Update camera FOV
  useEffect(() => {
    if (threeCamera instanceof THREE.PerspectiveCamera) {
      threeCamera.fov = camera.fov;
      threeCamera.updateProjectionMatrix();
    }
  }, [camera.fov, threeCamera]);

  // Apply initial camera heading/pitch to OrbitControls using useFrame
  // This ensures we wait until the controls ref is available
  useFrame(() => {
    if (initialCameraAppliedRef.current) return;
    if (!controlsRef.current) return;

    const controls = controlsRef.current;
    const { yaw, pitch } = initialCameraRef.current;

    // Convert our heading to OrbitControls azimuth (add offset)
    const azimuthRad = THREE.MathUtils.degToRad(yaw + HEADING_OFFSET);
    // Convert pitch to polar angle (90 - pitch)
    const polarRad = THREE.MathUtils.degToRad(90 - pitch);

    controls.setAzimuthalAngle(azimuthRad);
    controls.setPolarAngle(polarRad);
    controls.update();

    initialCameraAppliedRef.current = true;

    // Re-enable onChange after the next frame
    requestAnimationFrame(() => {
      suppressOnChangeRef.current = false;
    });
  });

  // Handle camera changes from controls
  const handleControlsChange = useCallback(() => {
    if (!controlsRef.current) return;

    // Skip if we're programmatically setting camera angles or haven't applied initial yet
    if (suppressOnChangeRef.current) return;

    const controls = controlsRef.current;
    const azimuth = THREE.MathUtils.radToDeg(controls.getAzimuthalAngle());
    const polar = THREE.MathUtils.radToDeg(controls.getPolarAngle());

    // Convert polar angle to pitch (-90 to 90)
    const pitch = 90 - polar;

    // Convert azimuth to our heading (subtract offset) and normalize to 0-360
    const heading = ((azimuth - HEADING_OFFSET) % 360 + 360) % 360;

    onCameraChange({ yaw: heading, pitch });
  }, [onCameraChange]);

  return (
    <>
      {/* Sky sphere with panorama texture */}
      <mesh scale={[-1, 1, 1]}>
        <sphereGeometry args={[500, 64, 32]} />
        <meshBasicMaterial
          map={texture}
          side={THREE.BackSide}
          toneMapped={false}
        />
      </mesh>

      {/* Camera controls */}
      <OrbitControls
        ref={controlsRef}
        enableZoom={true}
        enablePan={false}
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
  onCameraChange,
  isLoading,
}: PanoramaCanvasProps) {
  return (
    <div className="absolute inset-0">
      <Canvas
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
        }}
      >
        <color attach="background" args={["#0a0f1a"]} />
        <PanoramaSphere
          imageUrl={imageUrl}
          camera={camera}
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
