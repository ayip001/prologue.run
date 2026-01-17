"use client";

import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { CameraState } from "@/types";
import { clampFov } from "@/lib/viewState";
import { CAMERA_CONSTRAINTS } from "@/lib/constants";

// Offset to convert between our heading (0 = forward) and OrbitControls azimuth (0 = -Z axis)
const HEADING_OFFSET = 90;

interface HeadingData {
  headingDegrees: number | null;
  headingToPrev: number | null;
  headingToNext: number | null;
}

interface PanoramaCanvasProps {
  imageUrl: string | null;
  camera: CameraState;
  initialCamera: { yaw: number; pitch: number };
  onCameraChange: (camera: Partial<CameraState>) => void;
  isLoading: boolean;
  headingData: HeadingData | null;
  onNavigateNext?: () => void;
  onNavigatePrev?: () => void;
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

// Calculate arrow position in spherical coordinates
// Returns the relative heading for the arrow (0-360)
function calculateArrowHeading(
  imageHeading: number,
  targetHeading: number
): number {
  // Calculate relative angle: where the target is relative to image's orientation
  let relativeAngle = targetHeading - imageHeading;
  // Normalize to 0-360
  relativeAngle = ((relativeAngle % 360) + 360) % 360;
  return relativeAngle;
}

// Clamp arrow heading to improve UX - keep arrows in expected zones
// Next arrow: 0-20° or 340-360° (forward area)
// Prev arrow: 160-200° (backward area)
// Then reflect: e.g., 14.1h → 345.9h, 161h → 199h
function clampArrowHeading(heading: number, direction: "next" | "prev"): number {
  let clamped: number;

  if (direction === "next") {
    // Forward zone: 0-20° or 340-360°
    // Convert to -180 to 180 range for easier comparison
    let h = heading;
    if (h > 180) h -= 360; // Now in range -180 to 180, where 0 is forward

    // Clamp to -20 to 20
    if (h > 20) h = 20;
    if (h < -20) h = -20;

    // Convert back to 0-360
    clamped = h < 0 ? h + 360 : h;
  } else {
    // Backward zone: 160-200° (centered on 180°)
    // Clamp to this range
    if (heading < 160) clamped = 160;
    else if (heading > 200) clamped = 200;
    else clamped = heading;
  }

  // Reflect: 360 - heading (e.g., 14.1 → 345.9, 161 → 199)
  return (360 - clamped) % 360;
}

// Convert spherical coordinates to cartesian for positioning in the scene
// heading: 0-360, 0 = forward (where camera faces at azimuth 90°)
// pitch: degrees, negative = down
function sphericalToCartesian(
  heading: number,
  pitch: number,
  radius: number
): [number, number, number] {
  const headingRad = THREE.MathUtils.degToRad(heading);
  const pitchRad = THREE.MathUtils.degToRad(pitch);

  // At heading 0, we want position along -X (where camera looks at azimuth 90°)
  // At heading 90, we want position along +Z
  const horizontalRadius = radius * Math.cos(pitchRad);
  const x = -horizontalRadius * Math.cos(headingRad);
  const y = radius * Math.sin(pitchRad);
  const z = horizontalRadius * Math.sin(headingRad);

  return [x, y, z];
}

// Ground navigation arrow component using mesh for perspective distortion
interface GroundArrowProps {
  heading: number; // Where to position the arrow (0-360)
  direction: "next" | "prev";
  onClick: () => void;
}

// Track logged headings to avoid duplicate logs
const loggedArrows = new Set<string>();

// Expose debug functions to window for console access
if (typeof window !== "undefined") {
  (window as any).setArrowRotation = (dir: "next" | "prev", x: number, y: number, z: number) => {
    const mesh = (window as any)[`__arrow_${dir}`] as THREE.Mesh | undefined;
    if (!mesh) {
      console.log(`Arrow "${dir}" not found`);
      return;
    }
    mesh.rotation.set(
      THREE.MathUtils.degToRad(x),
      THREE.MathUtils.degToRad(y),
      THREE.MathUtils.degToRad(z)
    );
    console.log(`Set ${dir} rotation: [${x}°, ${y}°, ${z}°]`);
  };

  (window as any).getArrowRotation = (dir: "next" | "prev") => {
    const mesh = (window as any)[`__arrow_${dir}`] as THREE.Mesh | undefined;
    if (!mesh) {
      console.log(`Arrow "${dir}" not found`);
      return null;
    }
    const r = mesh.rotation;
    const result = {
      x: Math.round(THREE.MathUtils.radToDeg(r.x) * 10) / 10,
      y: Math.round(THREE.MathUtils.radToDeg(r.y) * 10) / 10,
      z: Math.round(THREE.MathUtils.radToDeg(r.z) * 10) / 10
    };
    console.log(`${dir} rotation: [${result.x}°, ${result.y}°, ${result.z}°]`);
    return result;
  };

  (window as any).getArrowInfo = (dir: "next" | "prev") => {
    const mesh = (window as any)[`__arrow_${dir}`] as THREE.Mesh | undefined;
    const heading = (window as any)[`__arrow_${dir}_heading`] as number | undefined;
    if (!mesh) {
      console.log(`Arrow "${dir}" not found`);
      return null;
    }
    const p = mesh.position;
    const r = mesh.rotation;
    console.log(`${dir} arrow (heading=${heading}°):`);
    console.log(`  pos: [${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}]`);
    console.log(`  rot: [${THREE.MathUtils.radToDeg(r.x).toFixed(1)}°, ${THREE.MathUtils.radToDeg(r.y).toFixed(1)}°, ${THREE.MathUtils.radToDeg(r.z).toFixed(1)}°]`);
    return { position: { x: p.x, y: p.y, z: p.z }, rotation: { x: THREE.MathUtils.radToDeg(r.x), y: THREE.MathUtils.radToDeg(r.y), z: THREE.MathUtils.radToDeg(r.z) }, heading };
  };
}

function GroundArrow({ heading, direction, onClick }: GroundArrowProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [isHovered, setIsHovered] = useState(false);
  const { gl } = useThree();

  // Position arrow on the ground (pitch around -35 degrees)
  const groundPitch = -35;
  const distance = 50;
  const position = sphericalToCartesian(heading, groundPitch, distance);

  // Handle cursor style
  useEffect(() => {
    if (isHovered) {
      gl.domElement.style.cursor = "pointer";
    } else {
      gl.domElement.style.cursor = "";
    }
    return () => {
      gl.domElement.style.cursor = "";
    };
  }, [isHovered, gl]);

  // Store mesh ref globally for console debugging
  useEffect(() => {
    if (meshRef.current && typeof window !== "undefined") {
      (window as any)[`__arrow_${direction}`] = meshRef.current;
      (window as any)[`__arrow_${direction}_heading`] = heading;
    }
    return () => {
      if (typeof window !== "undefined") {
        delete (window as any)[`__arrow_${direction}`];
        delete (window as any)[`__arrow_${direction}_heading`];
      }
    };
  }, [direction, heading]);

  // Apply rotation using matrix-based approach for correct orientation
  useEffect(() => {
    if (!meshRef.current) return;

    const mesh = meshRef.current;
    const pos = new THREE.Vector3(position[0], position[1], position[2]);

    // Direction from arrow toward camera (origin) - this will be plane's -Z
    const toCamera = pos.clone().negate().normalize();

    // Horizontal radial direction (outward in XZ plane, away from camera)
    // This is the direction the triangle should point
    const radialHorizontal = new THREE.Vector3(pos.x, 0, pos.z).normalize();

    // Project radialHorizontal onto the plane perpendicular to toCamera
    // to get the direction the triangle should point within the visible plane
    const dot = radialHorizontal.dot(toCamera);
    const triangleDir = radialHorizontal.clone().sub(toCamera.clone().multiplyScalar(dot));

    // Handle edge case where projection is near zero
    if (triangleDir.length() < 0.001) {
      triangleDir.set(0, -1, 0); // Fallback: point downward
    }
    triangleDir.normalize();

    // Build orthonormal basis:
    // +Z points away from camera (so front face is visible)
    // +Y points in triangle direction (radially outward)
    // +X is perpendicular
    const zAxis = toCamera.clone().negate();
    let yAxis = triangleDir.clone();
    let xAxis = new THREE.Vector3().crossVectors(yAxis, zAxis).normalize();

    // Recompute Y to ensure perfect orthogonality
    yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();

    // Create rotation matrix and apply
    const rotMatrix = new THREE.Matrix4();
    rotMatrix.makeBasis(xAxis, yAxis, zAxis);
    mesh.rotation.setFromRotationMatrix(rotMatrix);

    // Apply tilt for ground perspective (foreshortening effect)
    mesh.rotateX(THREE.MathUtils.degToRad(-groundPitch));

    // Debug logging - only once per unique heading (dedupe)
    const logKey = `${direction}-${heading.toFixed(1)}`;
    if (!loggedArrows.has(logKey)) {
      loggedArrows.add(logKey);
      const euler = mesh.rotation;
      console.log(`[Arrow ${direction}] h=${heading.toFixed(1)}° pos=[${position[0].toFixed(1)}, ${position[1].toFixed(1)}, ${position[2].toFixed(1)}] rot=[${THREE.MathUtils.radToDeg(euler.x).toFixed(1)}°, ${THREE.MathUtils.radToDeg(euler.y).toFixed(1)}°, ${THREE.MathUtils.radToDeg(euler.z).toFixed(1)}°]`);
    }
  }, [heading, groundPitch, direction, position]);

  // Create texture: filled tall isosceles triangle for "next", bordered for "prev"
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    const size = 128;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.clearRect(0, 0, size, size);

    // Draw circle background (indigo with 90% opacity)
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(99, 102, 241, 0.9)";
    ctx.fill();

    // Draw border (thin gray)
    ctx.strokeStyle = "rgba(156, 163, 175, 0.8)";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw tall isosceles triangle pointing up
    ctx.beginPath();
    const triHeight = size * 0.45;
    const triWidth = size * 0.3;
    const centerX = size / 2;
    const centerY = size / 2;

    // Triangle vertices: top point, bottom-left, bottom-right
    ctx.moveTo(centerX, centerY - triHeight / 2);                    // Top
    ctx.lineTo(centerX - triWidth / 2, centerY + triHeight / 2);     // Bottom-left
    ctx.lineTo(centerX + triWidth / 2, centerY + triHeight / 2);     // Bottom-right
    ctx.closePath();

    if (direction === "next") {
      // Filled triangle for forward
      ctx.fillStyle = "white";
      ctx.fill();
    } else {
      // Bordered triangle for backward
      ctx.strokeStyle = "white";
      ctx.lineWidth = 4;
      ctx.lineJoin = "round";
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, [direction]);

  // Hovered texture (brighter)
  const hoveredTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    const size = 128;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.clearRect(0, 0, size, size);

    // Draw circle background (brighter indigo for hover)
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(129, 140, 248, 0.95)";
    ctx.fill();

    // Draw border (lighter for hover)
    ctx.strokeStyle = "rgba(209, 213, 219, 0.9)";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw tall isosceles triangle pointing up
    ctx.beginPath();
    const triHeight = size * 0.45;
    const triWidth = size * 0.3;
    const centerX = size / 2;
    const centerY = size / 2;

    ctx.moveTo(centerX, centerY - triHeight / 2);
    ctx.lineTo(centerX - triWidth / 2, centerY + triHeight / 2);
    ctx.lineTo(centerX + triWidth / 2, centerY + triHeight / 2);
    ctx.closePath();

    if (direction === "next") {
      ctx.fillStyle = "white";
      ctx.fill();
    } else {
      ctx.strokeStyle = "white";
      ctx.lineWidth = 4;
      ctx.lineJoin = "round";
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, [direction]);

  if (!texture || !hoveredTexture) return null;

  return (
    <mesh
      ref={meshRef}
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setIsHovered(true);
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        setIsHovered(false);
      }}
    >
      <circleGeometry args={[4, 32]} />
      <meshBasicMaterial
        map={isHovered ? hoveredTexture : texture}
        transparent={true}
        side={THREE.DoubleSide}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
}

function PanoramaSphere({
  imageUrl,
  initialCamera,
  fov,
  onCameraChange,
  headingData,
  onNavigateNext,
  onNavigatePrev,
}: {
  imageUrl: string | null;
  initialCamera: { yaw: number; pitch: number };
  fov: number;
  onCameraChange: (camera: Partial<CameraState>) => void;
  headingData: HeadingData | null;
  onNavigateNext?: () => void;
  onNavigatePrev?: () => void;
}) {
  const { camera: threeCamera, invalidate: invalidateFrame, gl } = useThree();
  const controlsRef = useRef<any>(null);
  const textureRef = useRef<THREE.Texture | null>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  // Calculate arrow headings based on heading data
  const arrowHeadings = useMemo(() => {
    if (!headingData || headingData.headingDegrees === null) {
      return { next: null, prev: null };
    }

    const imageHeading = headingData.headingDegrees;

    // Calculate next arrow heading and clamp to forward zone (0-20° or 340-360°)
    let nextHeading: number | null = null;
    if (headingData.headingToNext !== null && onNavigateNext) {
      const rawHeading = calculateArrowHeading(imageHeading, headingData.headingToNext);
      nextHeading = clampArrowHeading(rawHeading, "next");
    }

    // Calculate prev arrow heading and clamp to backward zone (160-200°)
    let prevHeading: number | null = null;
    if (headingData.headingToPrev !== null && onNavigatePrev) {
      const rawHeading = calculateArrowHeading(imageHeading, headingData.headingToPrev);
      prevHeading = clampArrowHeading(rawHeading, "prev");
    }

    return { next: nextHeading, prev: prevHeading };
  }, [headingData, onNavigateNext, onNavigatePrev]);

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
    // Required for cross-origin images, especially on iOS Safari
    loader.crossOrigin = "anonymous";
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

      {/* Ground navigation arrows */}
      {arrowHeadings.next !== null && onNavigateNext && (
        <GroundArrow
          heading={arrowHeadings.next}
          direction="next"
          onClick={onNavigateNext}
        />
      )}
      {arrowHeadings.prev !== null && onNavigatePrev && (
        <GroundArrow
          heading={arrowHeadings.prev}
          direction="prev"
          onClick={onNavigatePrev}
        />
      )}

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
  headingData,
  onNavigateNext,
  onNavigatePrev,
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
      >
        <color attach="background" args={["#0a0f1a"]} />
        <PanoramaSphere
          imageUrl={imageUrl}
          initialCamera={initialCamera}
          fov={camera.fov}
          onCameraChange={onCameraChange}
          headingData={headingData}
          onNavigateNext={onNavigateNext}
          onNavigatePrev={onNavigatePrev}
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
