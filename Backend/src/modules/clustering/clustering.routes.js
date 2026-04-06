import express from "express";
import { body, param, query } from "express-validator";
import { authUser } from "../../middleware/auth.middleware.js";
import {
  submitRideForClustering,
  getRideClusteringStatus,
  getActiveClusters,
  getBatchedRides,
  getClusterDetails,
  getBatchDetails,
  forceBatchCluster,
  getClusteringStats,
} from "./clustering.controller.js";

const router = express.Router();

/**
 * Submit a ride request to clustering/batching system
 * This is called after a ride has been created via /api/ride/book-ride
 *
 * @method POST
 * @path /api/clustering/submit-ride
 * @body {string} ride_id - The ride request ID to process
 */
router.post(
  "/submit-ride",
  [body("ride_id").matches(/^[0-9a-fA-F]{24}$/).withMessage("Invalid ride ID format")],
  authUser,
  submitRideForClustering
);

/**
 * Get clustering/batching status of a specific ride
 *
 * @method GET
 * @path /api/clustering/ride-status/:ride_id
 */
router.get(
  "/ride-status/:ride_id",
  [param("ride_id").matches(/^[0-9a-fA-F]{24}$/).withMessage("Invalid ride ID format")],
  authUser,
  getRideClusteringStatus
);

/**
 * Get all active clusters for an office (optional: filter by scheduled time)
 *
 * @method GET
 * @path /api/clustering/clusters/:office_id
 * @query {string} scheduled_at - Optional ISO 8601 datetime to filter by
 */
router.get(
  "/clusters/:office_id",
  [
    param("office_id").matches(/^[0-9a-fA-F]{24}$/).withMessage("Invalid office ID format"),
    query("scheduled_at")
      .optional()
      .isISO8601()
      .withMessage("scheduled_at must be valid ISO 8601 date"),
  ],
  getActiveClusters
);

/**
 * Get all active clusters for an office (optional: filter by status)
 *
 * @method GET
 * @path /api/clustering/batched/:office_id
 * @query {string} status - Optional filter: PENDING, ASSIGNED, IN_TRANSIT, COMPLETED
 */
router.get(
  "/batched/:office_id",
  [
    param("office_id").matches(/^[0-9a-fA-F]{24}$/).withMessage("Invalid office ID format"),
    query("status")
      .optional()
      .isIn(["PENDING", "ASSIGNED", "IN_TRANSIT", "COMPLETED", "CANCELLED"])
      .withMessage("Invalid batch status"),
  ],
  getBatchedRides
);

/**
 * Get detailed information about a specific cluster
 *
 * @method GET
 * @path /api/clustering/cluster/:cluster_id
 */
router.get(
  "/cluster/:cluster_id",
  [param("cluster_id").matches(/^[0-9a-fA-F]{24}$/).withMessage("Invalid cluster ID format")],
  getClusterDetails
);

/**
 * Get detailed information about a specific batched ride
 *
 * @method GET
 * @path /api/clustering/batch/:batch_id
 */
router.get(
  "/batch/:batch_id",
  [param("batch_id").matches(/^[0-9a-fA-F]{24}$/).withMessage("Invalid batch ID format")],
  getBatchDetails
);

/**
 * Force-batch a cluster (move from CLUSTERING to BATCHED)
 * Typically called by scheduled job or manual override
 *
 * @method POST
 * @path /api/clustering/force-batch/:cluster_id
 * @body {string} reason - Optional reason for force-batching
 */
router.post(
  "/force-batch/:cluster_id",
  [
    param("cluster_id").matches(/^[0-9a-fA-F]{24}$/).withMessage("Invalid cluster ID format"),
    body("reason").optional().isString().withMessage("Reason must be a string"),
  ],
  forceBatchCluster
);

/**
 * Get clustering statistics for an office
 * Returns counts of active clusters, batches, etc.
 *
 * @method GET
 * @path /api/clustering/stats/:office_id
 */
router.get(
  "/stats/:office_id",
  [param("office_id").matches(/^[0-9a-fA-F]{24}$/).withMessage("Invalid office ID format")],
  getClusteringStats
);

export default router;
