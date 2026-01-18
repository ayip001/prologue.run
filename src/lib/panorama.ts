import * as THREE from "three";

// Convert spherical coordinates to cartesian for positioning in the scene
// heading: 0-360, 0 = forward (where camera faces at azimuth 90°)
// pitch: degrees, negative = down
export function sphericalToCartesian(
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
