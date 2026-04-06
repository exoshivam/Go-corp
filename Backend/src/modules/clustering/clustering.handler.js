import { Clustering } from "./clustering.model.js";
import { BatchedRide } from "./batched.model.js";
import { RideRequest } from "../ride/ride.model.js";
import { getRoute } from "../../utils/osrm.js";
import { canCluster, findBestClusterMatch } from "./clustering.service.js";
import ApiError from "../../utils/ApiError.js";

/**
 * Main handler for processing a new ride request through clustering logic
 * Routes the ride to appropriate case handler based on group size and preferences
 *
 * @param {Object} rideRequest - The ride request document from DB
 * @returns {Promise<{type: string, result: Object}>} 
 *   type: "SOLO" | "BATCHED" | "CLUSTERING"
 *   result: { ride_id, destination, message, batch_id or cluster_id }
 */
export async function processRideForClustering(rideRequest) {
  const groupSize = 1 + (rideRequest.invited_employee_ids?.length || 0);

  // Case 1: Solo with solo_preference = true
  if (groupSize === 1 && rideRequest.solo_preference === true) {
    return handleCase1_SoloPreference(rideRequest);
  }

  // Case 6: Group of 4 (max)
  if (groupSize === 4) {
    return handleCase6_FullGroup(rideRequest);
  }

  // Cases 2-3: Single person, solo_preference = false
  if (groupSize === 1) {
    // Check if there are existing clusters for this office within time window
    const timeWindow = 10 * 60 * 1000; // 10 minutes
    const scheduledTime = new Date(rideRequest.scheduled_at);
    const existingClusters = await Clustering.findOne({
      office_id: rideRequest.office_id,
      status: "ACTIVE",
      scheduled_at: {
        $gte: new Date(scheduledTime.getTime() - timeWindow),
        $lte: new Date(scheduledTime.getTime() + timeWindow)
      }
    });

    if (existingClusters) {
      // Case 3: Another single person - check for merge
      return handleCase3_AnotherSingle(rideRequest);
    } else {
      // Case 2: First single person - create new cluster
      return handleCase2_SingleNoPreference(rideRequest);
    }
  }

  if (groupSize === 2) {
    // Case 4: Person with 1 invited (group size = 2)
    return handleCase4_GroupOf2(rideRequest);
  }

  if (groupSize === 3) {
    // Case 5: Person with 2 invited (group size = 3)
    return handleCase5_GroupOf3(rideRequest);
  }

  throw new ApiError(400, "Invalid group size for clustering");
}

/**
 * Case 1: Single person, solo_preference = true
 * Skip clustering, send directly to Batched
 *
 * @param {Object} rideRequest
 * @returns {Promise<{type: string, result: Object}>}
 */
async function handleCase1_SoloPreference(rideRequest) {
  console.log(
    `[Case 1] Processing solo ride with preference: ${rideRequest._id}`
  );

  // Generate route polyline
  const polyline = await getRoute(
    rideRequest.pickup_location.coordinates,
    rideRequest.drop_location.coordinates
  );

  // Create BatchedRide directly
  const batchedRide = await BatchedRide.create({
    office_id: rideRequest.office_id,
    ride_request_ids: [rideRequest._id],
    total_size: 1,
    scheduled_at: rideRequest.scheduled_at,
    pickup_location: rideRequest.pickup_location,
    drop_location: rideRequest.drop_location,
    route_polyline: polyline,
    pickup_order: new Map([[rideRequest._id.toString(), 1]]),
    batch_reason: "SOLO",
  });

  // Update RideRequest status
  await RideRequest.findByIdAndUpdate(rideRequest._id, {
    status: "BOOKED_SOLO",
    batch_id: batchedRide._id,
  });

  return {
    type: "SOLO",
    result: {
      ride_id: rideRequest._id,
      batch_id: batchedRide._id,
      message: "Ride booked as solo",
      destination: "BATCHED",
    },
  };
}

/**
 * Case 2: Single person, solo_preference = false
 * Move to Clustering, generate route polyline (first entry, no clustering check needed)
 *
 * @param {Object} rideRequest
 * @returns {Promise<{type: string, result: Object}>}
 */
async function handleCase2_SingleNoPreference(rideRequest) {
  console.log(
    `[Case 2] Processing single ride without preference: ${rideRequest._id}`
  );

  // Generate route polyline
  const polyline = await getRoute(
    rideRequest.pickup_location.coordinates,
    rideRequest.drop_location.coordinates
  );

  // Create new Clustering entry
  const cluster = await Clustering.create({
    office_id: rideRequest.office_id,
    ride_request_ids: [rideRequest._id],
    total_size: 1,
    scheduled_at: rideRequest.scheduled_at,
    pickup_location: rideRequest.pickup_location,
    drop_location: rideRequest.drop_location,
    route_polyline: polyline,
    pickup_order: new Map([[rideRequest._id.toString(), 1]]),
    status: "ACTIVE",
    metadata: {
      reason_for_clustering: "First entry, no clustering check needed",
    },
  });

  // Update RideRequest status
  await RideRequest.findByIdAndUpdate(rideRequest._id, {
    status: "IN_CLUSTERING",
  });

  return {
    type: "CLUSTERING",
    result: {
      ride_id: rideRequest._id,
      cluster_id: cluster._id,
      message: "Ride moved to clustering as first entry",
      destination: "CLUSTERING",
    },
  };
}

/**
 * Case 3: Another single person, solo_preference = false
 * Move to Clustering, run can_cluster against all existing Clustering entries
 * If compatible, merge. If not, create own route polyline and stay in Clustering
 *
 * @param {Object} rideRequest
 * @returns {Promise<{type: string, result: Object}>}
 */
async function handleCase3_AnotherSingle(rideRequest) {
  console.log(
    `[Case 3] Processing another single ride without preference: ${rideRequest._id}`
  );

  // Get active clusters for this office within ±10 minute time window
  const timeWindow = 10 * 60 * 1000; // 10 minutes in milliseconds
  const scheduledTime = new Date(rideRequest.scheduled_at);
  const activeClusters = await Clustering.find({
    office_id: rideRequest.office_id,
    status: "ACTIVE",
    scheduled_at: {
      $gte: new Date(scheduledTime.getTime() - timeWindow),
      $lte: new Date(scheduledTime.getTime() + timeWindow)
    }
  });

  // Find best matching cluster (no size restriction for single)
  const { match: matchingCluster, reason } = await findBestClusterMatch(
    rideRequest,
    activeClusters
  );

  if (matchingCluster) {
    // Merge with existing cluster
    const merged = await mergeIntoCluster(rideRequest, matchingCluster, reason);

    // Check if cluster reached size 4 after merge
    const updatedCluster = await Clustering.findById(matchingCluster._id);
    if (updatedCluster.total_size === 4) {
      // Move cluster to Batched
      const moved = await moveClusterToBatched(
        updatedCluster,
        "REACHED_SIZE_4"
      );
      return {
        type: "BATCHED",
        result: {
          ride_id: rideRequest._id,
          cluster_id: matchingCluster._id,
          batch_id: moved.batch_id,
          message: "Ride merged and cluster reached size 4, moved to batched",
          destination: "BATCHED",
        },
      };
    }

    return merged;
  } else {
    // Create own clustering entry
    const polyline = await getRoute(
      rideRequest.pickup_location.coordinates,
      rideRequest.drop_location.coordinates
    );

    const cluster = await Clustering.create({
      office_id: rideRequest.office_id,
      ride_request_ids: [rideRequest._id],
      total_size: 1,
      scheduled_at: rideRequest.scheduled_at,
      pickup_location: rideRequest.pickup_location,
      drop_location: rideRequest.drop_location,
      route_polyline: polyline,
      pickup_order: new Map([[rideRequest._id.toString(), 1]]),
      status: "ACTIVE",
      metadata: {
        reason_for_clustering: "No compatible clusters, created own",
      },
    });

    await RideRequest.findByIdAndUpdate(rideRequest._id, {
      status: "IN_CLUSTERING",
    });

    return {
      type: "CLUSTERING",
      result: {
        ride_id: rideRequest._id,
        cluster_id: cluster._id,
        message: "Ride created new cluster (no compatible matches)",
        destination: "CLUSTERING",
      },
    };
  }
}

/**
 * Case 4: Person with 1 invited (group size = 2)
 * Move to Clustering, run can_cluster only against entries whose current size is 1 or 2
 * If merged and total size = 4, move to Batched
 * Otherwise stay in Clustering
 *
 * @param {Object} rideRequest
 * @returns {Promise<{type: string, result: Object}>}
 */
async function handleCase4_GroupOf2(rideRequest) {
  console.log(`[Case 4] Processing group of 2: ${rideRequest._id}`);

  const groupSize = 2;

  // Get active clusters for this office with size 1 or 2, within ±10 minute window
  const timeWindow = 10 * 60 * 1000; // 10 minutes in milliseconds
  const scheduledTime = new Date(rideRequest.scheduled_at);
  const activeClusters = await Clustering.find({
    office_id: rideRequest.office_id,
    status: "ACTIVE",
    scheduled_at: {
      $gte: new Date(scheduledTime.getTime() - timeWindow),
      $lte: new Date(scheduledTime.getTime() + timeWindow)
    },
    total_size: { $in: [1, 2] },
  });

  // Find best match (prioritizing size-2 first, then size-1)
  const { match: matchingCluster, reason } = await findBestClusterMatch(
    rideRequest,
    activeClusters,
    2 // max cluster size to check against
  );

  if (matchingCluster) {
    // Merge into cluster
    const merged = await mergeIntoCluster(rideRequest, matchingCluster, reason);

    // Check if total size reached 4 after merge
    const updatedCluster = await Clustering.findById(matchingCluster._id);
    if (updatedCluster.total_size === 4) {
      // Move cluster to Batched
      const moved = await moveClusterToBatched(
        updatedCluster,
        "REACHED_SIZE_4"
      );
      return {
        type: "BATCHED",
        result: {
          ride_id: rideRequest._id,
          cluster_id: matchingCluster._id,
          batch_id: moved.batch_id,
          message: "Ride merged and cluster reached size 4, moved to batched",
          destination: "BATCHED",
        },
      };
    }

    return merged;
  } else {
    // Create own clustering entry
    const polyline = await getRoute(
      rideRequest.pickup_location.coordinates,
      rideRequest.drop_location.coordinates
    );

    const cluster = await Clustering.create({
      office_id: rideRequest.office_id,
      ride_request_ids: [rideRequest._id],
      total_size: groupSize,
      scheduled_at: rideRequest.scheduled_at,
      pickup_location: rideRequest.pickup_location,
      drop_location: rideRequest.drop_location,
      route_polyline: polyline,
      pickup_order: new Map([[rideRequest._id.toString(), 1]]),
      status: "ACTIVE",
      metadata: {
        reason_for_clustering: "Group of 2, no compatible clusters",
      },
    });

    await RideRequest.findByIdAndUpdate(rideRequest._id, {
      status: "IN_CLUSTERING",
    });

    return {
      type: "CLUSTERING",
      result: {
        ride_id: rideRequest._id,
        cluster_id: cluster._id,
        message: "Group of 2 created new cluster (no compatible matches)",
        destination: "CLUSTERING",
      },
    };
  }
}

/**
 * Case 5: Person with 2 invited (group size = 3)
 * Move to Clustering, run can_cluster only against entries whose current size = 1
 * If merged, total = 4, move to Batched
 * If not, create own route polyline and stay in Clustering
 *
 * @param {Object} rideRequest
 * @returns {Promise<{type: string, result: Object}>}
 */
async function handleCase5_GroupOf3(rideRequest) {
  console.log(`[Case 5] Processing group of 3: ${rideRequest._id}`);

  const groupSize = 3;

  // Get active clusters for this office with size = 1 only, within ±10 minute window
  // (since 3 + 1 = 4, any other size would exceed 4)
  const timeWindow = 10 * 60 * 1000; // 10 minutes in milliseconds
  const scheduledTime = new Date(rideRequest.scheduled_at);
  const activeClusters = await Clustering.find({
    office_id: rideRequest.office_id,
    status: "ACTIVE",
    scheduled_at: {
      $gte: new Date(scheduledTime.getTime() - timeWindow),
      $lte: new Date(scheduledTime.getTime() + timeWindow)
    },
    total_size: 1,
  });

  // Find best match
  const { match: matchingCluster, reason } = await findBestClusterMatch(
    rideRequest,
    activeClusters,
    1 // only check against size-1 clusters
  );

  if (matchingCluster) {
    // Merge into cluster (will become size 4)
    const merged = await mergeIntoCluster(rideRequest, matchingCluster, reason);

    // Move to Batched immediately (total = 4)
    const cluster = await Clustering.findById(matchingCluster._id);
    const moved = await moveClusterToBatched(cluster, "REACHED_SIZE_4");

    return {
      type: "BATCHED",
      result: {
        ride_id: rideRequest._id,
        cluster_id: matchingCluster._id,
        batch_id: moved.batch_id,
        message: "Group of 3 merged with size-1, reached batch size 4",
        destination: "BATCHED",
      },
    };
  } else {
    // Create own clustering entry
    const polyline = await getRoute(
      rideRequest.pickup_location.coordinates,
      rideRequest.drop_location.coordinates
    );

    const cluster = await Clustering.create({
      office_id: rideRequest.office_id,
      ride_request_ids: [rideRequest._id],
      total_size: groupSize,
      scheduled_at: rideRequest.scheduled_at,
      pickup_location: rideRequest.pickup_location,
      drop_location: rideRequest.drop_location,
      route_polyline: polyline,
      pickup_order: new Map([[rideRequest._id.toString(), 1]]),
      status: "ACTIVE",
      metadata: {
        reason_for_clustering: "Group of 3, no compatible size-1 clusters",
      },
    });

    await RideRequest.findByIdAndUpdate(rideRequest._id, {
      status: "IN_CLUSTERING",
    });

    return {
      type: "CLUSTERING",
      result: {
        ride_id: rideRequest._id,
        cluster_id: cluster._id,
        message: "Group of 3 created new cluster (no compatible matches)",
        destination: "CLUSTERING",
      },
    };
  }
}

/**
 * Case 6: Person with 3 invited (group size = 4)
 * Skip clustering, send directly to Batched (full group)
 *
 * @param {Object} rideRequest
 * @returns {Promise<{type: string, result: Object}>}
 */
async function handleCase6_FullGroup(rideRequest) {
  console.log(`[Case 6] Processing full group of 4: ${rideRequest._id}`);

  // Generate route polyline
  const polyline = await getRoute(
    rideRequest.pickup_location.coordinates,
    rideRequest.drop_location.coordinates
  );

  // Create BatchedRide directly
  const batchedRide = await BatchedRide.create({
    office_id: rideRequest.office_id,
    ride_request_ids: [rideRequest._id],
    total_size: 4,
    scheduled_at: rideRequest.scheduled_at,
    pickup_location: rideRequest.pickup_location,
    drop_location: rideRequest.drop_location,
    route_polyline: polyline,
    pickup_order: new Map([[rideRequest._id.toString(), 1]]),
    batch_reason: "FULL_SIZE",
  });

  // Update RideRequest status
  await RideRequest.findByIdAndUpdate(rideRequest._id, {
    status: "BOOKED_SOLO",
    batch_id: batchedRide._id,
  });

  return {
    type: "SOLO",
    result: {
      ride_id: rideRequest._id,
      batch_id: batchedRide._id,
      message: "Full group of 4 sent directly to batched",
      destination: "BATCHED",
    },
  };
}

/**
 * Helper: Merge a ride request into an existing cluster
 * Also regenerates the route polyline to include the new ride
 *
 * @param {Object} newRideRequest
 * @param {Object} clusterDoc
 * @param {string} reason - Clustering reason
 * @returns {Promise<{type: string, result: Object}>}
 */
async function mergeIntoCluster(newRideRequest, clusterDoc, reason) {
  console.log(
    `Merging ride ${newRideRequest._id} into cluster ${clusterDoc._id}`
  );

  const newGroupSize = 1 + (newRideRequest.invited_employee_ids?.length || 0);
  const newTotalSize = clusterDoc.total_size + newGroupSize;

  if (newTotalSize > 4) {
    throw new ApiError(400, "Cluster would exceed maximum size of 4");
  }

  // Add ride to cluster
  clusterDoc.ride_request_ids.push(newRideRequest._id);
  clusterDoc.total_size = newTotalSize;
  clusterDoc.pickup_order.set(newRideRequest._id.toString(), newTotalSize);
  clusterDoc.metadata.reason_for_clustering = reason;
  clusterDoc.updated_at = new Date();

  // Regenerate route polyline with all rides in cluster
  const allRides = await RideRequest.find({
    _id: { $in: clusterDoc.ride_request_ids },
  });

  // Use first pickup and last drop for polyline
  const firstPickup = allRides[0].pickup_location.coordinates;
  const lastDrop = allRides[allRides.length - 1].drop_location.coordinates;

  const newPolyline = await getRoute(firstPickup, lastDrop);
  clusterDoc.route_polyline = newPolyline;

  await clusterDoc.save();

  // Update RideRequest status
  await RideRequest.findByIdAndUpdate(newRideRequest._id, {
    status: "IN_CLUSTERING",
  });

  return {
    type: "CLUSTERING",
    result: {
      ride_id: newRideRequest._id,
      cluster_id: clusterDoc._id,
      message: `Ride merged into cluster (now size ${newTotalSize})`,
      destination: "CLUSTERING",
    },
  };
}

/**
 * Helper: Move a cluster from CLUSTERING to BATCHED
 *
 * @param {Object} clusterDoc
 * @param {string} batchReason - Reason for batching
 * @returns {Promise<{batch_id: ObjectId}>}
 */
async function moveClusterToBatched(clusterDoc, batchReason) {
  console.log(
    `Moving cluster ${clusterDoc._id} to batched (reason: ${batchReason})`
  );

  // Create BatchedRide
  const batchedRide = await BatchedRide.create({
    office_id: clusterDoc.office_id,
    ride_request_ids: clusterDoc.ride_request_ids,
    total_size: clusterDoc.total_size,
    scheduled_at: clusterDoc.scheduled_at,
    pickup_location: clusterDoc.pickup_location,
    drop_location: clusterDoc.drop_location,
    route_polyline: clusterDoc.route_polyline,
    pickup_order: clusterDoc.pickup_order,
    clustering_id: clusterDoc._id,
    batch_reason: batchReason,
  });

  // Update cluster status
  clusterDoc.status = "BATCHED";
  clusterDoc.batch_id = batchedRide._id;
  clusterDoc.updated_at = new Date();
  await clusterDoc.save();

  // Update all RideRequest statuses
  await RideRequest.updateMany(
    { _id: { $in: clusterDoc.ride_request_ids } },
    {
      status: "BOOKED_SOLO",
      batch_id: batchedRide._id,
    }
  );

  return { batch_id: batchedRide._id };
}
