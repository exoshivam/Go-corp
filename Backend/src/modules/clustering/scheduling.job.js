import cron from "node-cron";
import { Clustering } from "./clustering.model.js";
import { BatchedRide } from "./batched.model.js";
import { RideRequest } from "../ride/ride.model.js";

/**
 * Force-batch job that runs every minute
 * Checks for clusters whose scheduled time is 10 minutes away
 * and force-batches them immediately
 *
 * This allows at least 10 minutes for:
 * - Driver assignment
 * - Driver notifications/acceptance
 * - Pickup coordination
 */
export function startForceBatchJob() {
  // Run every minute (at :00 seconds)
  const job = cron.schedule("* * * * *", async () => {
    try {
      console.log(
        `[${new Date().toISOString()}] Running force-batch job...`
      );

      // Calculate the time threshold: now + 10 minutes
      // Any cluster with scheduled time <= this threshold should be batched
      const now = new Date();
      const tenMinutesFromNow = new Date(now.getTime() + 10 * 60 * 1000);

      // Find all ACTIVE/FULL clusters that need to be force-batched
      // scheduled_at must be <= 10 minutes from now
      const clustersToForce = await Clustering.find({
        status: { $in: ["ACTIVE", "FULL"] },
        scheduled_at: { $lte: tenMinutesFromNow },
      }).sort({ scheduled_at: 1 });

      if (clustersToForce.length === 0) {
        console.log(
          `[${new Date().toISOString()}] No clusters require force-batching`
        );
        return;
      }

      console.log(
        `[${new Date().toISOString()}] Found ${clustersToForce.length} clusters to force-batch`
      );

      // Process each cluster
      let successCount = 0;
      let errorCount = 0;

      for (const cluster of clustersToForce) {
        try {
          await forceBatchClusterHelper(cluster);
          successCount++;
        } catch (error) {
          console.error(
            `[${new Date().toISOString()}] Error force-batching cluster ${cluster._id}:`,
            error.message
          );
          errorCount++;
        }
      }

      console.log(
        `[${new Date().toISOString()}] Force-batch job completed: ${successCount} success, ${errorCount} errors`
      );
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] Unexpected error in force-batch job:`,
        error.message
      );
    }
  });

  console.log("Force-batch scheduled job initialized (runs every minute)");
  return job;
}

/**
 * Helper function to actually perform the force-batch operation
 *
 * @param {Object} clusterDoc - Cluster document to batch
 */
async function forceBatchClusterHelper(clusterDoc) {
  console.log(
    `[${new Date().toISOString()}] Force-batching cluster ${clusterDoc._id} (scheduled: ${clusterDoc.scheduled_at})`
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
    batch_reason: "FORCE_BATCH",
    metadata: {
      Notes: `Force-batched at ${new Date().toISOString()} (within 10 min of scheduled time)`,
    },
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

  console.log(
    `[${new Date().toISOString()}] Cluster ${clusterDoc._id} successfully force-batched to ${batchedRide._id}`
  );

  return batchedRide;
}

/**
 * Stop the force-batch job (useful for cleanup)
 *
 * @param {Object} job - The cron job object returned from startForceBatchJob()
 */
export function stopForceBatchJob(job) {
  if (job) {
    job.stop();
    console.log("Force-batch scheduled job stopped");
  }
}
