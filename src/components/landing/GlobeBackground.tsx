"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

interface GlobeBackgroundProps {
  color?: number;
  color2?: number;
  backgroundColor?: number;
  points?: number;
  maxDistance?: number;
  spacing?: number;
  showDots?: boolean;
  mouseControls?: boolean;
  speed?: number;
  size?: number;
}

const SVG_PATHS = [
  "m642.64 182.49c-38.59-51.01-95.91-80.26-157.25-80.26h-161.26-128.68l-18.8 68h128.68 180.06c39.85 0 77.4 19.42 103.02 53.29 23.78 31.43 33.89 70.76 28.35 108.06q-1.26 8.43-3.58 16.68-1.21 4.29-2.77 8.53c-8.34 22.94-23.75 44.33-44.07 60.94-23.47 19.2-50.98 29.79-77.46 29.79h-74.18c-110.72 0-207.31 74.88-234.88 182.12l-17.52 68.13h70.21 18.59 22.98l30.78-106.13c2.15-7.41 5.05-14.44 8.63-21 13.53-24.92 36.56-43.3 63.65-51.05 9.28-2.67 19.04-4.07 29.06-4.07h8.5 74.18c42.13 0 84.93-16.04 120.51-45.15 33.5-27.41 58.09-64.21 69.23-103.63q1.4-4.94 2.53-9.95c13.58-59.62-0.49-124.06-38.51-174.3z",
  "m578.85 230.77c-23.34-30.85-57.4-48.54-93.46-48.54h-183.37-128.69l-18.8 68-4.98 18-72.75 263.12c24.19-43.3 59.33-81.94 102.98-112.5 21.1-14.78 43.67-27.36 67.2-37.59l31.26-113.03 4.97-18h202.18c14.78 0 28.71 7.66 39.23 21.56 9.18 12.14 13.95 27.08 13.57 41.29-0.12 4.59-0.78 9.09-2 13.41-6.24 22.09-31.23 41.03-47.31 41.03h-91.48c-54 0-108.06 12.97-156.69 36.44-83.98 40.55-151.75 112.37-174.97 202.68l-28.47 91.13h112.63l18.29-71.13c6.66-25.91 17.16-50 30.79-71.77 45.6-72.79 126.27-119.35 215.72-119.35h74.18c48.07 0 98.65-40.62 112.75-90.54 2.94-10.4 4.46-21.13 4.6-31.9 0.39-28.92-9.09-58.15-27.38-82.31z",
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getBrightness(color: THREE.Color): number {
  return 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
}

function cubicBezier(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const k = 1 - t;
  return p0 * k * k * k + 3 * p1 * k * k * t + 3 * p2 * k * t * t + p3 * t * t * t;
}

function quadBezier(p0: number, p1: number, p2: number, t: number): number {
  const k = 1 - t;
  return k * k * p0 + 2 * k * t * p1 + t * t * p2;
}

function processSVG(svgPaths: string[]): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const scale = 0.05;
  const centerX = 366;
  const centerY = 400;
  const samples = 12;

  const getVec = (x: number, y: number): THREE.Vector3 => {
    return new THREE.Vector3((x - centerX) * scale, (centerY - y) * scale, 0);
  };

  svgPaths.forEach((pathData) => {
    const tokens = pathData.match(/([a-df-z])|([-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?)/gi);
    if (!tokens) return;

    let i = 0;
    let cur = { x: 0, y: 0 };
    let start = { x: 0, y: 0 };
    let lastCmd: string | null = null;

    const isNum = () => i < tokens.length && !isNaN(parseFloat(tokens[i]));
    const nextNum = () => parseFloat(tokens[i++]);

    while (i < tokens.length) {
      let cmd = tokens[i];
      if (isNaN(parseFloat(cmd))) {
        lastCmd = cmd;
        i++;
      } else {
        cmd = lastCmd!;
      }

      const lowerCmd = cmd.toLowerCase();
      const rel = cmd === lowerCmd;

      switch (lowerCmd) {
        case "m": {
          let x = nextNum();
          let y = nextNum();
          if (rel) {
            x += cur.x;
            y += cur.y;
          }
          cur = { x, y };
          start = { x, y };
          while (isNum()) {
            let nx = nextNum();
            let ny = nextNum();
            if (rel) {
              nx += cur.x;
              ny += cur.y;
            }
            points.push(getVec(cur.x, cur.y));
            points.push(getVec(nx, ny));
            cur = { x: nx, y: ny };
          }
          break;
        }
        case "l": {
          do {
            let x = nextNum();
            let y = nextNum();
            if (rel) {
              x += cur.x;
              y += cur.y;
            }
            points.push(getVec(cur.x, cur.y));
            points.push(getVec(x, y));
            cur = { x, y };
          } while (isNum());
          break;
        }
        case "h": {
          do {
            let x = nextNum();
            if (rel) x += cur.x;
            points.push(getVec(cur.x, cur.y));
            points.push(getVec(x, cur.y));
            cur.x = x;
          } while (isNum());
          break;
        }
        case "v": {
          do {
            let y = nextNum();
            if (rel) y += cur.y;
            points.push(getVec(cur.x, cur.y));
            points.push(getVec(cur.x, y));
            cur.y = y;
          } while (isNum());
          break;
        }
        case "z": {
          if (cur.x !== start.x || cur.y !== start.y) {
            points.push(getVec(cur.x, cur.y));
            points.push(getVec(start.x, start.y));
          }
          cur = { x: start.x, y: start.y };
          break;
        }
        case "c": {
          do {
            let x1 = nextNum(),
              y1 = nextNum();
            let x2 = nextNum(),
              y2 = nextNum();
            let x3 = nextNum(),
              y3 = nextNum();
            if (rel) {
              x1 += cur.x;
              y1 += cur.y;
              x2 += cur.x;
              y2 += cur.y;
              x3 += cur.x;
              y3 += cur.y;
            }

            let prevP = getVec(cur.x, cur.y);
            for (let s = 1; s <= samples; s++) {
              const t = s / samples;
              const tx = cubicBezier(cur.x, x1, x2, x3, t);
              const ty = cubicBezier(cur.y, y1, y2, y3, t);
              const nextP = getVec(tx, ty);
              points.push(prevP);
              points.push(nextP);
              prevP = nextP;
            }
            cur = { x: x3, y: y3 };
          } while (isNum());
          break;
        }
        case "q": {
          do {
            let x1 = nextNum(),
              y1 = nextNum();
            let x2 = nextNum(),
              y2 = nextNum();
            if (rel) {
              x1 += cur.x;
              y1 += cur.y;
              x2 += cur.x;
              y2 += cur.y;
            }

            let prevP = getVec(cur.x, cur.y);
            for (let s = 1; s <= samples; s++) {
              const t = s / samples;
              const tx = quadBezier(cur.x, x1, x2, t);
              const ty = quadBezier(cur.y, y1, y2, t);
              const nextP = getVec(tx, ty);
              points.push(prevP);
              points.push(nextP);
              prevP = nextP;
            }
            cur = { x: x2, y: y2 };
          } while (isNum());
          break;
        }
      }
    }
  });
  return points;
}

interface PointData extends THREE.Mesh {
  ox: number;
  oy: number;
  oz: number;
}

interface ExtendedCamera extends THREE.PerspectiveCamera {
  ox?: number;
  oy?: number;
  oz?: number;
  tx?: number;
  ty?: number;
  tz?: number;
}

export function GlobeBackground({
  color = 0xffffff,
  color2 = 0xffffff,
  backgroundColor = 0x000000,
  points: n = 12,
  maxDistance = 22,
  spacing = 16,
  showDots = true,
  mouseControls = true,
  speed = 1,
  size = 2,
}: GlobeBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animationFrameRef = useRef<number>(0);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    let width = container.offsetWidth;
    let height = container.offsetHeight;
    let mouseX = width / 2;
    let mouseY = height / 2;
    let t = 0;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    const camera: ExtendedCamera = new THREE.PerspectiveCamera(25, width / height, 0.01, 10000);
    camera.position.set(50, 100, 150);
    scene.add(camera);

    const ambience = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambience);

    const spot = new THREE.SpotLight(0xffffff, 1);
    spot.position.set(0, 200, 0);
    spot.distance = 400;
    scene.add(spot);

    const cont = new THREE.Group();
    cont.position.set(-50, -20, 0);
    scene.add(cont);
    spot.target = cont;

    const numPoints = n * n * 2;
    const linePositions = new Float32Array(numPoints * numPoints * 3);
    const lineColors = new Float32Array(numPoints * numPoints * 3);

    const colorB = getBrightness(new THREE.Color(color));
    const bgB = getBrightness(new THREE.Color(backgroundColor));
    const blending = colorB > bgB ? "additive" : "subtractive";

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(linePositions, 3).setUsage(THREE.DynamicDrawUsage)
    );
    geometry.setAttribute(
      "color",
      new THREE.BufferAttribute(lineColors, 3).setUsage(THREE.DynamicDrawUsage)
    );
    geometry.computeBoundingSphere();
    geometry.setDrawRange(0, 0);

    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      blending: blending === "additive" ? THREE.AdditiveBlending : THREE.NormalBlending,
      transparent: true,
    });

    const linesMesh = new THREE.LineSegments(geometry, material);
    cont.add(linesMesh);

    const pointsData: PointData[] = [];
    for (let i = 0; i <= n; i++) {
      for (let j = 0; j <= n; j++) {
        const y = 0;
        const x = (i - n / 2) * spacing;
        const z = (j - n / 2) * spacing;

        let baseObject: THREE.Object3D;
        if (showDots) {
          const geom = new THREE.SphereGeometry(0.25, 12, 12);
          const mat = new THREE.MeshLambertMaterial({ color });
          baseObject = new THREE.Mesh(geom, mat);
        } else {
          baseObject = new THREE.Object3D();
        }
        cont.add(baseObject);

        const sphere = baseObject as unknown as PointData;
        sphere.ox = x;
        sphere.oy = y;
        sphere.oz = z;
        sphere.position.set(x, y, z);
        pointsData.push(sphere);
      }
    }

    const cont2 = new THREE.Group();
    cont2.position.set(0, 15, 0);
    scene.add(cont2);

    const svgPoints = processSVG(SVG_PATHS);
    const svgGeometry = new THREE.BufferGeometry().setFromPoints(svgPoints);
    const svgMaterial = new THREE.LineBasicMaterial({
      color: color2,
      linewidth: 2,
      transparent: true,
      opacity: 0.8,
    });

    const linesMesh3 = new THREE.LineSegments(svgGeometry, svgMaterial);
    linesMesh3.position.set(0, 0, 0);
    cont2.add(linesMesh3);

    const wireMat = new THREE.LineBasicMaterial({ color });
    const sphereGeom = new THREE.SphereGeometry(18 * size, 18, 14);
    const edges = new THREE.EdgesGeometry(sphereGeom);
    const sphere = new THREE.LineSegments(edges, wireMat);
    cont2.add(sphere);

    cont2.rotation.x = -0.25;

    const onMouseMove = (e: MouseEvent) => {
      if (!mouseControls) return;

      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      mouseX = x;
      mouseY = y;

      const mouseNormX = x / width;
      const mouseNormY = y / height;

      if (!camera.oy) {
        camera.oy = camera.position.y;
        camera.ox = camera.position.x;
        camera.oz = camera.position.z;
      }

      const ang = Math.atan2(camera.oz!, camera.ox!);
      const dist = Math.sqrt(camera.oz! * camera.oz! + camera.ox! * camera.ox!);
      const tAng = ang + (mouseNormX - 0.5) * 1.5;

      camera.tz = dist * Math.sin(tAng);
      camera.tx = dist * Math.cos(tAng);
      camera.ty = camera.oy + (mouseNormY - 0.5) * 80;
    };

    const onResize = () => {
      width = container.offsetWidth;
      height = container.offsetHeight;

      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    if (mouseControls) {
      onMouseMove({
        clientX: mouseX,
        clientY: mouseY,
      } as MouseEvent);
    }

    window.addEventListener("resize", onResize);
    if (mouseControls) {
      window.addEventListener("mousemove", onMouseMove);
    }

    const bgColor = new THREE.Color(backgroundColor);
    const mainColor = new THREE.Color(color);
    const diffColor = mainColor.clone().sub(bgColor);

    const animate = () => {
      t += 0.01 * speed;

      if (camera.tx !== undefined) {
        const diffX = camera.tx - camera.position.x;
        const diffY = camera.ty! - camera.position.y;
        const diffZ = camera.tz! - camera.position.z;

        camera.position.x += diffX * 0.02;
        camera.position.y += diffY * 0.02;
        camera.position.z += diffZ * 0.02;
      }

      if (window.innerWidth < 480) {
        camera.lookAt(new THREE.Vector3(-10, 0, 0));
      } else if (window.innerWidth < 720) {
        camera.lookAt(new THREE.Vector3(-20, 0, 0));
      } else {
        camera.lookAt(new THREE.Vector3(-40, 0, 0));
      }

      sphere.rotation.y += 0.002;
      linesMesh3.rotation.y -= 0.004;

      let vertexpos = 0;
      let colorpos = 0;
      let numConnected = 0;

      for (let i = 0; i < pointsData.length; i++) {
        const p = pointsData[i];
        p.position.y = 2 * Math.sin(p.position.x / 10 + t + (p.position.z / 10) * 0.5);

        for (let j = i; j < pointsData.length; j++) {
          const p2 = pointsData[j];
          const dx = p.position.x - p2.position.x;
          const dy = p.position.y - p2.position.y;
          const dz = p.position.z - p2.position.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

          if (dist < maxDistance) {
            let lineColor: THREE.Color;
            const alpha = clamp((1.0 - dist / maxDistance) * 2, 0, 1);

            if (blending === "additive") {
              lineColor = new THREE.Color(0x000000).lerp(diffColor, alpha);
            } else {
              lineColor = bgColor.clone().lerp(mainColor, alpha);
            }

            linePositions[vertexpos++] = p.position.x;
            linePositions[vertexpos++] = p.position.y;
            linePositions[vertexpos++] = p.position.z;
            linePositions[vertexpos++] = p2.position.x;
            linePositions[vertexpos++] = p2.position.y;
            linePositions[vertexpos++] = p2.position.z;

            lineColors[colorpos++] = lineColor.r;
            lineColors[colorpos++] = lineColor.g;
            lineColors[colorpos++] = lineColor.b;
            lineColors[colorpos++] = lineColor.r;
            lineColors[colorpos++] = lineColor.g;
            lineColors[colorpos++] = lineColor.b;

            numConnected++;
          }
        }
      }

      linesMesh.geometry.setDrawRange(0, numConnected * 2);
      linesMesh.geometry.attributes.position.needsUpdate = true;
      linesMesh.geometry.attributes.color.needsUpdate = true;

      renderer.setClearColor(backgroundColor, 0);
      renderer.render(scene, camera);

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameRef.current);
      window.removeEventListener("resize", onResize);
      if (mouseControls) {
        window.removeEventListener("mousemove", onMouseMove);
      }

      renderer.dispose();
      geometry.dispose();
      material.dispose();
      svgGeometry.dispose();
      svgMaterial.dispose();
      sphereGeom.dispose();
      edges.dispose();
      wireMat.dispose();

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [color, color2, backgroundColor, n, maxDistance, spacing, showDots, mouseControls, speed, size]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full z-[1] opacity-30"
    />
  );
}
