import { getDistance } from "../../utils/geo.js";
import { getRoute } from "../../utils/osrm.js";
import { lineString, nearestPointOnLine } from "@turf/turf";

const ROUTE_BUFFER = 500; // meters
const TIME_WINDOW = 10 * 60 * 1000; // ±10 minutes in milliseconds
const PICKUP_LOCATION_THRESHOLD = 500; // meters - similar pickup location
const DROP_LOCATION_THRESHOLD = 500; // meters - similar drop location

/**
 * Step 1: Pre-filter check using bearing similarity and bounding box overlap
 * Cheap operation to eliminate obvious non-matches
 *
 * @param {Array<Number>} newPickup [lng, lat]
 * @param {Array<Number>} existingPickup [lng, lat]
 * @param {Array<Number>} newDrop [lng, lat]
 * @param {Array<Number>} existingDrop [lng, lat]
 * @returns {boolean} true if should proceed to Step 2
 */
export function preFilterPolylineCheck(
  newPickup,
  existingPickup,
  newDrop,
  existingDrop
) {
  // Check bearing similarity (0-360 degrees)
  const bearingNew = calculateBearing(newPickup, newDrop);
  const bearingExisting = calculateBearing(existingPickup, existingDrop);

  // Allow ±30 degree bearing difference (allowing some route variation)
  const bearingDiff = Math.abs(bearingNew - bearingExisting);
  const normalizedDiff = Math.min(bearingDiff, 360 - bearingDiff);

  if (normalizedDiff > 30) {
    return false; // Routes go in too different directions
  }

  // Check bounding box overlap
  // If bounding boxes don't overlap or touch, routes are too different
  const newBBox = getBoundingBox([newPickup, newDrop]);
  const existingBBox = getBoundingBox([existingPickup, existingDrop]);

  if (!boundingBoxesOverlap(newBBox, existingBBox)) {
    return false;
  }

  // Passed pre-filter, proceed to full polyline check
  return true;
}

/**
 * Step 2: Full check using actual polyline route buffer comparison
 *
 * @param {Array<Array<Number>>} polylineCoords Array of [lng, lat] tuples
 * @param {Array<Number>} pickupPoint [lng, lat]
 * @param {boolean} isPickupCheck true for pickup, false for drop
 * @returns {boolean} true if point is within ROUTE_BUFFER
 */
export async function checkPointWithinPolylineBuffer(
  polylineCoords,
  pickupPoint,
  isPickupCheck = true
) {
  if (!polylineCoords || polylineCoords.length < 2) {
    return false;
  }

  try {
    // Create a turf LineString from the polyline
    const line = lineString(polylineCoords);

    // Find the nearest point on the line to our pickup/drop point
    const nearest = nearestPointOnLine(line, pickupPoint);

    // Get the distance from the point to the nearest point on the line
    const distanceMeters = nearest.properties.dist * 1000; // turf returns km

    // Check if within buffer
    return distanceMeters <= ROUTE_BUFFER;
  } catch (error) {
    console.error(
      `Error checking ${isPickupCheck ? "pickup" : "drop"} point with polyline:`,
      error
    );
    return false;
  }
}

/**
 * Main clustering logic: Check if a ride can cluster with another
 *
 * Conditions for clustering:
 * 1. Similar pickup + similar drop + within time window
 * 2. Pickup within route buffer of existing route + similar drop + within time window
 *
 * @param {Object} newRide - New ride request
 * @param {Object} existingCluster - Existing cluster entry
 * @returns {Promise<{canCluster: boolean, reason: string}>}
 */
export async function canCluster(newRide, existingCluster) {
  // Validation
  if (!newRide || !existingCluster) {
    return { canCluster: false, reason: "Missing ride or cluster data" };
  }

  if (
    !newRide.pickup_location ||
    !newRide.drop_location ||
    !existingCluster.pickup_location ||
    !existingCluster.drop_location
  ) {
    return {
      canCluster: false,
      reason: "Missing location data in ride or cluster",
    };
  }

  // Extract coordinates
  const newPickup = newRide.pickup_location.coordinates;
  const newDrop = newRide.drop_location.coordinates;
  const clusterPickup = existingCluster.pickup_location.coordinates;
  const clusterDrop = existingCluster.drop_location.coordinates;
  const clusterScheduled = existingCluster.scheduled_at;
  const newScheduled = newRide.scheduled_at;

  // Check time window: ±10 minutes
  const timeDiff = Math.abs(
    new Date(clusterScheduled) - new Date(newScheduled)
  );
  if (timeDiff > TIME_WINDOW) {
    return { canCluster: false, reason: "Outside time window" };
  }

  // ========== Condition 1: Similar pickup + similar drop ==========
  const pickupDistance = getDistance(newPickup, clusterPickup);
  const dropDistance = getDistance(newDrop, clusterDrop);

  if (
    pickupDistance <= PICKUP_LOCATION_THRESHOLD &&
    dropDistance <= DROP_LOCATION_THRESHOLD
  ) {
    return {
      canCluster: true,
      reason: "Similar pickup_location + similar drop_location + within time window",
    };
  }

  // ========== Condition 2: Pickup within route buffer + similar drop ==========
  // Only if drop location is similar
  if (dropDistance <= DROP_LOCATION_THRESHOLD) {
    // Check if new ride's pickup is within route buffer of existing route polyline
    if (
      !existingCluster.route_polyline ||
      existingCluster.route_polyline.length === 0
    ) {
      // No polyline yet, use simple location check
      return { canCluster: false, reason: "No polyline data in existing cluster" };
    }

    // Step 1: Pre-filter check
    const passesPreFilter = preFilterPolylineCheck(
      newPickup,
      clusterPickup,
      newDrop,
      clusterDrop
    );

    if (!passesPreFilter) {
      return {
        canCluster: false,
        reason: "Failed pre-filter: bearing/bounding box mismatch",
      };
    }

    // Step 2: Full polyline check
    const pickupInBuffer = await checkPointWithinPolylineBuffer(
      existingCluster.route_polyline,
      newPickup,
      true
    );

    if (pickupInBuffer) {
      return {
        canCluster: true,
        reason: `Pickup within ${ROUTE_BUFFER}m route buffer + similar drop_location + within time window`,
      };
    }
  }

  // No clustering conditions met
  return {
    canCluster: false,
    reason: "Does not meet any clustering condition",
  };
}

/**
 * Calculate bearing between two points (in degrees, 0-360)
 * @param {Array<Number>} from [lng, lat]
 * @param {Array<Number>} to [lng, lat]
 * @returns {number} bearing in degrees
 */
function calculateBearing(from, to) {
  const [lon1, lat1] = from;
  const [lon2, lat2] = to;

  const dLon = lon2 - lon1;

  const y = Math.sin(toRad(dLon)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(dLon));

  let bearing = toDeg(Math.atan2(y, x));
  return (bearing + 360) % 360;
}

/**
 * Get bounding box from array of points
 * @param {Array<Array<Number>>} points [[lng, lat], ...]
 * @returns {Object} {minLng, maxLng, minLat, maxLat}
 */
function getBoundingBox(points) {
  const lngs = points.map((p) => p[0]);
  const lats = points.map((p) => p[1]);

  return {
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs),
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
  };
}

/**
 * Check if two bounding boxes overlap or touch
 * @param {Object} bbox1 {minLng, maxLng, minLat, maxLat}
 * @param {Object} bbox2 {minLng, maxLng, minLat, maxLat}
 * @returns {boolean}
 */
function boundingBoxesOverlap(bbox1, bbox2) {
  // Boxes overlap if they don't NOT overlap
  // NOT overlapping means:
  // - box1 is completely to the left of box2
  // - box1 is completely to the right of box2
  // - box1 is completely above box2
  // - box1 is completely below box2

  const noOverlap =
    bbox1.maxLng < bbox2.minLng ||
    bbox1.minLng > bbox2.maxLng ||
    bbox1.maxLat < bbox2.minLat ||
    bbox1.minLat > bbox2.maxLat;

  return !noOverlap;
}

// Helper functions for degree/radian conversion
function toRad(degrees) {
  return degrees * (Math.PI / 180);
}

function toDeg(radians) {
  return radians * (180 / Math.PI);
}

/**
 * Find best matching cluster for a new ride
 * With optimization: prioritize by group size
 *
 * Case handling: When a ride of size 2 arrives, prioritize checking size-2 entries first, then size-1
 *
 * @param {Object} newRide - New ride request
 * @param {Array<Object>} activeClusters - List of active clusters
 * @param {Number} maxClusterSize - Max size already in cluster (for filtering which clusters to check)
 * @returns {Promise<{match: Object|null, reason: string}>}
 */
export async function findBestClusterMatch(
  newRide,
  activeClusters,
  maxClusterSize = Infinity
) {
  if (!activeClusters || activeClusters.length === 0) {
    return { match: null, reason: "No active clusters to check against" };
  }

  const newRideSize = 1 + (newRide.invited_employee_ids?.length || 0);

  // Filter clusters that have room for this ride
  const validClusters = activeClusters.filter((cluster) => {
    const totalAfter = cluster.total_size + newRideSize;
    return totalAfter <= maxClusterSize && totalAfter <= 4;
  });

  if (validClusters.length === 0) {
    return { match: null, reason: "No clusters with available space" };
  }

  // Sort clusters by size (descending) for optimization
  // This ensures we try to hit size 4 faster
  const sortedClusters = validClusters.sort(
    (a, b) => b.total_size - a.total_size
  );

  // Check each cluster
  for (const cluster of sortedClusters) {
    const result = await canCluster(newRide, cluster);

    if (result.canCluster) {
      return { match: cluster, reason: result.reason };
    }
  }

  return { match: null, reason: "No compatible clusters found" };
}
