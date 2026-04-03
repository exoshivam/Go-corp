import { RideRequest } from "./ride.model.js";
import * as turf from "@turf/turf";
import { RideBatch } from "./batch.model.js";
import { processClusterRoute } from "./route.service.js";

const MAX_EXTRA_TIME = 300; // 5 minutes
const MAX_PICKUP_DISTANCE = 2000; // 2 km (quick filter)

const isPickupNear = (r1, r2) => {
  const p1 = turf.point(r1.pickup_location.coordinates);
  const p2 = turf.point(r2.pickup_location.coordinates);

  const dist = turf.distance(p1, p2, { units: "meters" });
  return dist <= 500;
};

const isDropSame = (r1, r2) => {
  const p1 = turf.point(r1.drop_location.coordinates);
  const p2 = turf.point(r2.drop_location.coordinates);

  const dist = turf.distance(p1, p2, { units: "meters" });
  return dist <= 250;
};

export const clusterRides = async ({ office_id, direction, scheduled_at }) => {
  console.log("Clustering started...");

  const start = new Date(new Date(scheduled_at).getTime() - 10 * 60 * 1000);
  const end = new Date(new Date(scheduled_at).getTime() + 10 * 60 * 1000);

  //fetch rides
  const rides = await getCandidateRides(office_id, direction, scheduled_at);

  console.log("Total rides fetched:", rides.length);

  //cluster them
  let clusters = await buildClusters(rides);
  console.log("\n--- INITIAL CLUSTERS ---");
  clusters.forEach((c, i) => {
    console.log(`Cluster ${i + 1}: size=${c.length}`);
  });

  //merge clusters by route
  clusters = await mergeClustersByRoute(clusters);
  console.log("\n--- FINAL CLUSTERS AFTER MERGE ---");
  clusters.forEach((c, i) => {
    console.log(`Cluster ${i + 1}: size=${c.length}`);
  });

  console.log("Clusters formed:", clusters.length);

  return clusters;
};

const getCandidateRides = async (office_id, direction, scheduled_at) => {
  const start = new Date(new Date(scheduled_at).getTime() - 10 * 60 * 1000);
  const end = new Date(new Date(scheduled_at).getTime() + 10 * 60 * 1000);

  const rides = await RideRequest.find({
    office_id,
    direction,
    scheduled_at: { $gte: start, $lte: end },
    status: { $in: ["PENDING", "CLUSTERED"] },
    solo_preference: false,
  });

  return rides;
};

// For each ride: Try to fit in existing cluster Else create new cluster
export const buildClusters = async (rides) => {
  //Split rides into OLD + NEW
  const existingClustersMap = new Map();
  const newRides = [];

  for (let ride of rides) {
    if (ride.status === "CLUSTERED" && ride.batch_id) {
      const key = ride.batch_id.toString();

      if (!existingClustersMap.has(key)) {
        existingClustersMap.set(key, []);
      }

      existingClustersMap.get(key).push(ride);
    } else {
      newRides.push(ride);
    }
  }

  const routeCache = new Map();

  const getRoute = async (cluster) => {
    const key = cluster
      .map((r) => r._id.toString())
      .sort()
      .join("-");

    if (routeCache.has(key)) {
      console.log("    ⚡ Using cached route");
      return routeCache.get(key);
    }

    console.log("    🌐 Fetching route from OSRM...");
    const { route } = await processClusterRoute(cluster);

    routeCache.set(key, route);
    return route;
  };

  const canAddRideByTime = async (cluster, ride) => {
    console.log("    ⏱ Checking time-based feasibility...");

    // current route
    const oldRoute = await getRoute(cluster);

    // new cluster with ride
    const testCluster = [...cluster, ride];

    const newRoute = await getRoute(testCluster);

    const extraTime = newRoute.duration - oldRoute.duration;

    console.log(`    ⏱ Old route: ${oldRoute.duration}s`);
    console.log(`    ⏱ New route: ${newRoute.duration}s`);
    console.log(`    ⏱ Extra time: ${extraTime}s`);

    return extraTime <= MAX_EXTRA_TIME;
  };

  console.log("\n=== BUILDING CLUSTERS (TIME-BASED) ===");

  // -------------------------------
  //SORT (farthest first)
  // -------------------------------
  rides.sort((a, b) => {
    const d1 = turf.distance(
      turf.point(a.pickup_location.coordinates),
      turf.point(a.drop_location.coordinates),
      { units: "meters" },
    );

    const d2 = turf.distance(
      turf.point(b.pickup_location.coordinates),
      turf.point(b.drop_location.coordinates),
      { units: "meters" },
    );

    return d2 - d1;
  });

  const clusters = Array.from(existingClustersMap.values());

  // -------------------------------
  //BUILD CLUSTERS
  // -------------------------------
  for (let ride of newRides) {
    console.log(`\n🚗 Processing Ride ${ride._id}`);

    let added = false;

    for (let cluster of clusters) {
      if (cluster.length >= 4) {
        console.log("  ⏭ Cluster full");
        continue;
      }

      console.log(`  → Trying cluster (size=${cluster.length})`);

      // -------------------------------
      //QUICK DISTANCE FILTER (FAST)
      // -------------------------------
      const firstRide = cluster[0];

      const approxDist = turf.distance(
        turf.point(firstRide.pickup_location.coordinates),
        turf.point(ride.pickup_location.coordinates),
        { units: "meters" },
      );

      console.log(`    📏 Approx distance: ${approxDist.toFixed(2)}m`);

      if (approxDist > MAX_PICKUP_DISTANCE) {
        console.log("    ❌ Too far → skip (no OSRM call)");
        continue;
      }

      // -------------------------------
      //DROP DISTANCE FILTER (NEW)
      // -------------------------------
      const dropDist = turf.distance(
        turf.point(cluster[0].drop_location.coordinates),
        turf.point(ride.drop_location.coordinates),
        { units: "meters" },
      );

      console.log(`    📦 Drop distance: ${dropDist.toFixed(2)}m`);

      if (dropDist > 2000) {
        console.log("    ❌ Drop too far → skip");
        continue; // ✅ NOW VALID
      }

      // -------------------------------
      //TIME-BASED CHECK (MAIN LOGIC)
      // -------------------------------
      const canAdd = await canAddRideByTime(cluster, ride);

      if (canAdd) {
        console.log("    ✅ Adding ride to cluster");

        // 🔥 store old key BEFORE modifying cluster
        const oldKey = cluster
          .map((r) => r._id.toString())
          .sort()
          .join("-");

        cluster.push(ride);

        // ❗ delete old cached route
        routeCache.delete(oldKey);
        added = true;

        break;
      } else {
        console.log("    ❌ Rejected (too much delay)");
      }
    }

    // -------------------------------
    //CREATE NEW CLUSTER
    // -------------------------------
    if (!added) {
      console.log("  ➕ Creating new cluster");
      clusters.push([ride]);
    }
  }

  console.log("\n=== FINAL CLUSTERS ===");
  clusters.forEach((c, i) => {
    console.log(`Cluster ${i + 1}: size=${c.length}`);
  });

  return clusters;
};

export const assignClusters = async (clusters, meta) => {
  console.log("\n--- ASSIGNING CLUSTERS TO BATCHES ---");
  for (let cluster of clusters) {
    console.log(`Creating batch for cluster size=${cluster.length}`);
    //process route
    const { ordered, route } = await processClusterRoute(cluster);

    let batch;

    // Check if cluster already has a batch
    if (cluster[0].batch_id) {
      batch = await RideBatch.findById(cluster[0].batch_id);

      console.log("♻️ Updating existing batch:", batch._id);

      // 🔥 ADD THIS (MISSING PIECE)
      await RideBatch.updateOne(
        { _id: batch._id },
        { route_polyline: route.geometry },
      );
    } else {
      batch = await RideBatch.create({
        ...meta,
        route_polyline: route.geometry,
      });

      console.log("🆕 Creating new batch:", batch._id);
    }

    const bulkOps = ordered.map((ride, index) => ({
      updateOne: {
        filter: { _id: ride._id },
        update: {
          batch_id: batch._id,
          status: "CLUSTERED",
          pickup_order: index + 1,
        },
      },
    }));

    await RideRequest.bulkWrite(bulkOps);
  }
};

export const mergeClustersByRoute = async (clusters) => {
  console.log("\n=== MERGE PROCESS STARTED ===");

  let mergedClusters = [...clusters];

  // -------------------------------
  //STEP 1: Precompute all routes in parallel
  // -------------------------------
  console.log("\n⚡ Precomputing routes for all clusters...");

  const routeCache = new Map();

  const routePromises = mergedClusters.map(async (cluster, index) => {
    const key = cluster
      .map((r) => r._id.toString())
      .sort()
      .join("-");

    const { route } = await processClusterRoute(cluster);

    routeCache.set(key, route);

    console.log(
      `  ✅ Route cached for Cluster ${index + 1} (size=${cluster.length})`,
    );
  });

  await Promise.all(routePromises);

  console.log("✅ All routes cached\n");

  // -------------------------------
  //Helper: Get cluster centroid
  // -------------------------------
  const getClusterCenter = (cluster) => {
    const points = cluster.map((r) =>
      turf.point(r.pickup_location.coordinates),
    );

    const center = turf.center(turf.featureCollection(points));

    return center.geometry.coordinates;
  };

  // -------------------------------
  //STEP 2: Merge logic
  // -------------------------------
  for (let i = 0; i < mergedClusters.length; i++) {
    let clusterA = mergedClusters[i];

    console.log(
      `\n🔵 Checking Cluster A (index=${i}, size=${clusterA.length})`,
    );

    // skip full clusters
    if (clusterA.length >= 4) {
      console.log("  ⏭ Skipping (already full)");
      continue;
    }

    const keyA = clusterA
      .map((r) => r._id.toString())
      .sort()
      .join("-");
    const routeA = routeCache.get(keyA);

    if (!routeA) {
      console.log("  ❌ No route found in cache, skipping...");
      continue;
    }

    let routeLine = turf.lineString(routeA.geometry.coordinates);

    const centerA = getClusterCenter(clusterA);

    for (let j = i + 1; j < mergedClusters.length; j++) {
      let clusterB = mergedClusters[j];

      console.log(
        `  → Comparing with Cluster B (index=${j}, size=${clusterB.length})`,
      );

      if (clusterB.length >= 4) {
        console.log("    ⏭ Skipping B (already full)");
        continue;
      }

      const centerB = getClusterCenter(clusterB);

      // -------------------------------
      //QUICK DISTANCE FILTER
      // -------------------------------
      const approxDist = turf.distance(
        turf.point(centerA),
        turf.point(centerB),
        { units: "meters" },
      );

      console.log(
        `    📏 Approx centroid distance: ${approxDist.toFixed(2)} meters`,
      );

      if (approxDist > 3000) {
        console.log("    ❌ Too far → skipping early");
        continue;
      }

      // -------------------------------
      //ROUTE COMPATIBILITY CHECK
      // -------------------------------
      let canMergeAll = true;

      for (let ride of clusterB) {
        const point = turf.point(ride.pickup_location.coordinates);

        const distance = turf.pointToLineDistance(point, routeLine, {
          units: "meters",
        });

        console.log(
          `    🚶 Ride ${ride._id} distance from route: ${distance.toFixed(2)}m`,
        );

        if (distance > 500) {
          console.log("    ❌ Ride too far from route → cannot merge");
          canMergeAll = false;
          break;
        }
      }

      // -------------------------------
      //CAPACITY CHECK
      // -------------------------------
      const newSize = clusterA.length + clusterB.length;

      if (canMergeAll && newSize <= 4) {
        console.log(`    ✅ MERGING Cluster B → A (new size=${newSize})`);

        clusterA.push(...clusterB);

        // IMPORTANT: remove B
        mergedClusters.splice(j, 1);
        j--;

        // -------------------------------
        //UPDATE ROUTE AFTER MERGE
        // -------------------------------
        const newKey = clusterA
          .map((r) => r._id.toString())
          .sort()
          .join("-");

        console.log("    🔄 Recomputing route after merge...");

        const { route: newRoute } = await processClusterRoute(clusterA);

        routeCache.set(newKey, newRoute);

        // 🔥 IMPORTANT: update routeLine after merge
        routeLine = turf.lineString(newRoute.geometry.coordinates);

        console.log("    ✅ Route updated after merge");
      } else {
        if (!canMergeAll) {
          console.log("    ❌ Merge failed: route deviation too large");
        } else {
          console.log("    ❌ Merge failed: capacity exceeded");
        }
      }
    }
  }

  console.log("\n=== MERGE PROCESS ENDED ===");

  console.log("\n📦 FINAL CLUSTERS:");
  mergedClusters.forEach((c, i) => {
    console.log(`Cluster ${i + 1}: size=${c.length}`);
  });

  return mergedClusters;
};
