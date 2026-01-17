// ============================================================================
// Database Models
// ============================================================================

export interface Race {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  flagEmoji: string | null;
  recordedYear: number | null;
  recordedBy: string | null;
  distanceMeters: number;
  raceDate: string | null;
  city: string | null;
  country: string | null;
  elevationGain: number | null;
  elevationLoss: number | null;
  elevationBars: number[] | null;
  minimapUrl: string | null;
  cardImageUrl: string | null;
  tier: "gold" | "silver" | "bronze" | null;
  totalImages: number;
  captureDate: string;
  captureDevice: string | null;
  status: "pending" | "processing" | "ready" | "error";
  isTesting: boolean;
  storageBucket: string;
  storagePrefix: string;
  totalViews: number;
  createdAt: string;
  updatedAt: string;
}

export interface ImageMeta {
  id: string;
  raceId: string;
  positionIndex: number;
  latitude: number | null;
  longitude: number | null;
  altitudeMeters: number | null;
  capturedAt: string;
  headingDegrees: number | null;
  headingToPrev: number | null;
  headingToNext: number | null;
  distanceFromStart: number | null;
  pathThumbnail: string;
  pathMedium: string;
  pathFull: string;
  fileSizeThumb: number | null;
  fileSizeMedium: number | null;
  fileSizeFull: number | null;
  hasBlurApplied: boolean;
  blurRegionsCount: number;
  createdAt: string;
}

export interface Waypoint {
  id: string;
  raceId: string;
  name: string;
  distanceMeters: number;
  endDistanceMeters: number | null;
  description: string | null;
}

export interface ElevationPoint {
  distanceMeters: number;
  elevationMeters: number;
  gradientPercent: number | null;
}

export interface RaceMarker {
  id: string;
  raceId: string;
  markerType: "km_marker" | "aid_station" | "water_stop" | "toilet" | "medical";
  label: string | null;
  description: string | null;
  distanceMeters: number;
  latitude: number | null;
  longitude: number | null;
  nearestImageId: string | null;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface RaceCardData {
  id: string;
  slug: string;
  name: string;
  flagEmoji: string | null;
  recordedYear: number | null;
  recordedBy: string | null;
  distanceMeters: number;
  elevationGain: number | null;
  elevationLoss: number | null;
  city: string | null;
  country: string | null;
  tier: "gold" | "silver" | "bronze" | null;
  cardImageUrl: string | null;
  minimapUrl: string | null;
  elevationBars: number[] | null;
  totalImages: number;
  isTesting: boolean;
  officialUrl?: string | null;
}

export interface RacesResponse {
  races: RaceCardData[];
}

export interface RaceDetailResponse {
  race: Race;
  images: Pick<
    ImageMeta,
    "id" | "positionIndex" | "latitude" | "longitude" | "distanceFromStart" | "capturedAt" | "headingDegrees" | "headingToPrev" | "headingToNext"
  >[];
  waypoints: Pick<Waypoint, "name" | "distanceMeters" | "endDistanceMeters">[];
}

export interface ElevationProfileResponse {
  totalDistance: number;
  minElevation: number;
  maxElevation: number;
  points: Array<{
    distance: number;
    elevation: number;
  }>;
  gridLabels: Array<{
    distance: number;
    label: string;
  }>;
}

export interface ImageUrlsResponse {
  images: Array<{
    positionIndex: number;
    urls: {
      thumbnail: string;
      medium: string;
      full: string;
    };
  }>;
}

// ============================================================================
// Viewer State Types
// ============================================================================

export interface ViewState {
  position: number;
  heading: number; // 0-360
  pitch: number; // -90 to 90
  fov: number; // 30-120
}

export interface CameraState {
  yaw: number; // 0-360 horizontal
  pitch: number; // -90 to +90 vertical
  fov: number; // 30-120 zoom
}

export interface ViewerState {
  currentIndex: number;
  currentDistance: number;
  camera: CameraState;
  loadedTier: "thumbnail" | "medium" | "full";
  isLoading: boolean;
  isHUDVisible: boolean;
  isDraggingScrubber: boolean;
}

export interface ViewerActions {
  goToIndex: (index: number) => void;
  goToDistance: (distanceM: number) => void;
  goNext: () => void;
  goPrevious: () => void;
  setCamera: (camera: Partial<CameraState>) => void;
  seekByDrag: (distance: number) => void;
}

// ============================================================================
// HUD Data Types
// ============================================================================

export interface HUDData {
  distanceKm: number;
  elevationM: number;
  waypointName: string | null;
}

export interface ElevationProfile {
  points: Array<{ distance: number; elevation: number }>;
  totalDistance: number;
  minElevation: number;
  maxElevation: number;
}

// ============================================================================
// Image Loading Types
// ============================================================================

export type ImageTier = "thumbnail" | "medium" | "full";

export interface ImageUrls {
  thumbnail: string;
  medium: string;
  full: string;
}
