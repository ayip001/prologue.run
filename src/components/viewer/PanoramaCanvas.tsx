"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { CameraState } from "@/types";

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
  const { camera: threeCamera } = useThree();
  const controlsRef = useRef<any>(null);
  const textureRef = useRef<THREE.Texture | null>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  // Load texture when URL changes
  useEffect(() => {
    if (!imageUrl) return;

    const loader = new THREE.TextureLoader();
    loader.load(
      imageUrl,
      (loadedTexture) => {
        loadedTexture.colorSpace = THREE.SRGBColorSpace;
        loadedTexture.minFilter = THREE.LinearFilter;
        loadedTexture.magFilter = THREE.LinearFilter;
        textureRef.current = loadedTexture;
        setTexture(loadedTexture);
      },
      undefined,
      (error) => {
        console.error("Error loading panorama texture:", error);
      }
    );

    return () => {
      if (textureRef.current) {
        textureRef.current.dispose();
      }
    };
  }, [imageUrl]);

  // Update camera FOV
  useEffect(() => {
    if (threeCamera instanceof THREE.PerspectiveCamera) {
      threeCamera.fov = camera.fov;
      threeCamera.updateProjectionMatrix();
    }
  }, [camera.fov, threeCamera]);

  // Handle camera changes from controls
  const handleControlsChange = useCallback(() => {
    if (!controlsRef.current) return;

    const controls = controlsRef.current;
    const azimuth = THREE.MathUtils.radToDeg(controls.getAzimuthalAngle());
    const polar = THREE.MathUtils.radToDeg(controls.getPolarAngle());

    // Convert polar angle to pitch (-90 to 90)
    const pitch = 90 - polar;

    // Normalize azimuth to 0-360
    const heading = ((azimuth % 360) + 360) % 360;

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
