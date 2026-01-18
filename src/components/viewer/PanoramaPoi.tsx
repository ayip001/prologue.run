"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Poi } from "@/types";
import { POI_CONFIG } from "@/lib/poi";
import { sphericalToCartesian } from "@/lib/panorama";

interface PanoramaPoiProps {
  poi: Poi;
  headingOffset?: number;
}

export function PanoramaPoi({ poi, headingOffset = 0 }: PanoramaPoiProps) {
  const spriteRef = useRef<THREE.Sprite>(null);
  const pulseRef = useRef<THREE.Sprite>(null);
  const config = POI_CONFIG[poi.type];

  const adjustedHeading = (poi.heading - headingOffset + 360) % 360;
  const position = useMemo(
    () => sphericalToCartesian(adjustedHeading, poi.pitch, 60),
    [adjustedHeading, poi.pitch]
  );

  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    const size = 128;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.clearRect(0, 0, size, size);

    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 6, 0, Math.PI * 2);
    ctx.fillStyle = config.color;
    ctx.fill();

    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(15, 23, 42, 0.6)";
    ctx.stroke();

    ctx.font = "64px 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(config.emoji, size / 2, size / 2 + 2);

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, [config.color, config.emoji]);

  const pulseTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    const size = 128;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.clearRect(0, 0, size, size);
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 6, 0, Math.PI * 2);
    ctx.fillStyle = config.color;
    ctx.fill();

    return new THREE.CanvasTexture(canvas);
  }, [config.color]);

  useFrame(({ clock }) => {
    if (!spriteRef.current || !pulseRef.current) return;
    
    const t = clock.getElapsedTime() * 0.5;
    const progress = t % 1;
    
    // Static main icon at 80% opacity
    spriteRef.current.scale.setScalar(8);
    if (spriteRef.current.material) {
      spriteRef.current.material.opacity = 0.8;
    }

    // Expanding pulse
    const pulseScale = 8 * (1 + progress); // Scale from 1x to 2x
    const pulseOpacity = 0.4 * (1 - progress); // Fade out
    
    pulseRef.current.scale.setScalar(pulseScale);
    if (pulseRef.current.material) {
      pulseRef.current.material.opacity = pulseOpacity;
    }
  });

  if (!texture || !pulseTexture) return null;

  return (
    <group position={position}>
      {/* Expanding Pulse */}
      <sprite ref={pulseRef}>
        <spriteMaterial
          map={pulseTexture}
          transparent
          depthTest={false}
          depthWrite={false}
        />
      </sprite>
      
      {/* Main Static Icon */}
      <sprite ref={spriteRef}>
        <spriteMaterial
          map={texture}
          transparent
          depthTest={false}
          depthWrite={false}
        />
      </sprite>
    </group>
  );
}

