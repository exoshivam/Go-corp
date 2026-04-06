import { RideRequest } from "../ride/ride.model.js";
import { Clustering } from "./clustering.model.js";
import { BatchedRide } from "./batched.model.js";
import { processRideForClustering } from "./clustering.handler.js";
import ApiResponse from "../../utils/ApiResponse.js";
import ApiError from "../../utils/ApiError.js";
import { validationResult } from "express-validator";

/**
 * Submit a ride request for clustering/batching
 * This is called AFTER a ride request has been created in the ride table
 * Processes it through clustering logic
 *
 * @route POST /api/clustering/submit-ride
 */
export const submitRideForClustering = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { ride_id } = req.body;

    // Fetch the ride request
    const rideRequest = await RideRequest.findById(ride_id).populate(
      "invited_employee_ids"
    );

    if (!rideRequest) {
      throw new ApiError(404, "Ride request not found");
    }

    // Process through clustering logic
    const result = await processRideForClustering(rideRequest);

    // Return based on destination type
    let statusCode = 200;
    let message = `Ride processed - ${result.result.message}`;

    if (
      result.type === "SOLO" ||
      result.result.destination === "BATCHED"
    ) {
      statusCode = 201;
      message = `Ride ${result.type === "SOLO" ? "booked as solo" : "batched prepared"} and ready for driver assignment`;
    } else if (result.result.destination === "CLUSTERING") {
      statusCode = 202;
      message = `Ride added to clustering pool`;
    }

    res.status(statusCode).json(
      new ApiResponse(statusCode, message, {
        ride_id: result.result.ride_id,
        type: result.type,
        cluster_id: result.result.cluster_id,
        batch_id: result.result.batch_id,
        destination: result.result.destination,
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get clustering status for a ride
 *
 * @route GET /api/clustering/ride-status/:ride_id
 */
export const getRideClusteringStatus = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { ride_id } = req.params;

    // Fetch ride request
    const rideRequest = await RideRequest.findById(ride_id)
      .populate("batch_id")
      .populate("invited_employee_ids", "name email");

    if (!rideRequest) {
      throw new ApiError(404, "Ride request not found");
    }

    const groupSize = 1 + (rideRequest.invited_employee_ids?.length || 0);

    // Check if in clustering
    const clusteringEntry = await Clustering.findOne({
      ride_request_ids: ride_id,
    });

    // Check if batched
    const batchedEntry = await BatchedRide.findOne({
      ride_request_ids: ride_id,
    });

    const data = {
      ride_id: rideRequest._id,
      status: rideRequest.status,
      group_size: groupSize,
      scheduled_at: rideRequest.scheduled_at,
      pickup: {
        address: rideRequest.pickup_address,
        coordinates: rideRequest.pickup_location.coordinates,
      },
      drop: {
        address: rideRequest.drop_address,
        coordinates: rideRequest.drop_location.coordinates,
      },
      invited_employees: rideRequest.invited_employee_ids,
    };

    if (clusteringEntry) {
      data.clustering = {
        cluster_id: clusteringEntry._id,
        cluster_size: clusteringEntry.total_size,
        cluster_status: clusteringEntry.status,
        other_rides_in_cluster:
          clusteringEntry.ride_request_ids.length - 1,
      };
    }

    if (batchedEntry) {
      data.batched = {
        batch_id: batchedEntry._id,
        batch_size: batchedEntry.total_size,
        batch_status: batchedEntry.status,
        batch_reason: batchedEntry.batch_reason,
        driver_id: batchedEntry.driver_id,
        other_rides_in_batch: batchedEntry.ride_request_ids.length - 1,
      };
    }

    res.status(200).json(
      new ApiResponse(200, "Ride clustering status retrieved", data)
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get all active clusters for an office
 *
 * @route GET /api/clustering/clusters/:office_id
 */
export const getActiveClusters = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { office_id } = req.params;
    const { scheduled_at } = req.query; // Optional filter by scheduled time

    const query = {
      office_id,
      status: { $in: ["ACTIVE", "FULL"] },
    };

    if (scheduled_at) {
      const scheduled = new Date(scheduled_at);
      query.scheduled_at = scheduled;
    }

    const clusters = await Clustering.find(query)
      .populate("ride_request_ids", "employee_id invited_employee_ids scheduled_at")
      .select(
        "ride_request_ids total_size scheduled_at status pickup_location drop_location created_at metadata"
      );

    res.status(200).json(
      new ApiResponse(200, "Active clusters retrieved", {
        count: clusters.length,
        clusters,
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get all batched rides for an office
 *
 * @route GET /api/clustering/batched/:office_id
 */
export const getBatchedRides = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { office_id } = req.params;
    const { status } = req.query; // Optional filter by batch status

    const query = { office_id };

    if (status) {
      query.status = status;
    }

    const batches = await BatchedRide.find(query)
      .populate("ride_request_ids", "employee_id invited_employee_ids scheduled_at")
      .populate("driver_id", "name email vehicle_type")
      .select(
        "ride_request_ids total_size scheduled_at status driver_id batch_reason assigned_at created_at"
      )
      .sort({ created_at: -1 });

    res.status(200).json(
      new ApiResponse(200, "Batched rides retrieved", {
        count: batches.length,
        batches,
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get details of a specific cluster
 *
 * @route GET /api/clustering/cluster/:cluster_id
 */
export const getClusterDetails = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { cluster_id } = req.params;

    const cluster = await Clustering.findById(cluster_id)
      .populate({
        path: "ride_request_ids",
        select:
          "employee_id invited_employee_ids scheduled_at pickup_address drop_address pickup_location drop_location solo_preference",
      })
      .populate("batch_id");

    if (!cluster) {
      throw new ApiError(404, "Cluster not found");
    }

    // Get employee details for all rides
    const rideDetails = cluster.ride_request_ids.map((ride) => ({
      ride_id: ride._id,
      requester_id: ride.employee_id,
      invited_count: ride.invited_employee_ids?.length || 0,
      group_size: 1 + (ride.invited_employee_ids?.length || 0),
      pickup: {
        address: ride.pickup_address,
        coordinates: ride.pickup_location.coordinates,
      },
      drop: {
        address: ride.drop_address,
        coordinates: ride.drop_location.coordinates,
      },
      solo_preference: ride.solo_preference,
    }));

    const data = {
      cluster_id: cluster._id,
      office_id: cluster.office_id,
      total_size: cluster.total_size,
      status: cluster.status,
      scheduled_at: cluster.scheduled_at,
      pickup_location: cluster.pickup_location,
      drop_location: cluster.drop_location,
      route_polyline: cluster.route_polyline,
      rides: rideDetails,
      batch_id: cluster.batch_id,
      created_at: cluster.created_at,
      updated_at: cluster.updated_at,
      metadata: cluster.metadata,
    };

    res.status(200).json(
      new ApiResponse(200, "Cluster details retrieved", data)
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get details of a specific batched ride
 *
 * @route GET /api/clustering/batch/:batch_id
 */
export const getBatchDetails = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { batch_id } = req.params;

    const batch = await BatchedRide.findById(batch_id)
      .populate({
        path: "ride_request_ids",
        select:
          "employee_id invited_employee_ids scheduled_at pickup_address drop_address pickup_location drop_location solo_preference",
      })
      .populate("driver_id", "name email phone contact vehicle_type")
      .populate("clustering_id");

    if (!batch) {
      throw new ApiError(404, "Batch not found");
    }

    // Get employee details for all rides
    const rideDetails = batch.ride_request_ids.map((ride) => ({
      ride_id: ride._id,
      requester_id: ride.employee_id,
      invited_count: ride.invited_employee_ids?.length || 0,
      group_size: 1 + (ride.invited_employee_ids?.length || 0),
      pickup: {
        address: ride.pickup_address,
        coordinates: ride.pickup_location.coordinates,
      },
      drop: {
        address: ride.drop_address,
        coordinates: ride.drop_location.coordinates,
      },
      solo_preference: ride.solo_preference,
    }));

    const data = {
      batch_id: batch._id,
      office_id: batch.office_id,
      total_size: batch.total_size,
      status: batch.status,
      scheduled_at: batch.scheduled_at,
      pickup_location: batch.pickup_location,
      drop_location: batch.drop_location,
      route_polyline: batch.route_polyline,
      rides: rideDetails,
      driver: batch.driver_id,
      assigned_at: batch.assigned_at,
      batch_reason: batch.batch_reason,
      clustering_id: batch.clustering_id,
      created_at: batch.created_at,
      updated_at: batch.updated_at,
    };

    res.status(200).json(
      new ApiResponse(200, "Batch details retrieved", data)
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Force-batch a cluster (move from Clustering to Batched before size 4)
 * Used by scheduled job or manual override
 *
 * @route POST /api/clustering/force-batch/:cluster_id
 */
export const forceBatchCluster = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { cluster_id } = req.params;
    const { reason } = req.body;

    const cluster = await Clustering.findById(cluster_id);

    if (!cluster) {
      throw new ApiError(404, "Cluster not found");
    }

    if (cluster.status !== "ACTIVE") {
      throw new ApiError(400, `Cluster is already ${cluster.status}`);
    }

    // Create BatchedRide
    const batchedRide = await BatchedRide.create({
      office_id: cluster.office_id,
      ride_request_ids: cluster.ride_request_ids,
      total_size: cluster.total_size,
      scheduled_at: cluster.scheduled_at,
      pickup_location: cluster.pickup_location,
      drop_location: cluster.drop_location,
      route_polyline: cluster.route_polyline,
      pickup_order: cluster.pickup_order,
      clustering_id: cluster._id,
      batch_reason: "FORCE_BATCH",
      metadata: {
        Notes: reason || "Force-batched by system",
      },
    });

    // Update cluster status
    cluster.status = "BATCHED";
    cluster.batch_id = batchedRide._id;
    cluster.updated_at = new Date();
    await cluster.save();

    // Update RideRequest statuses
    await RideRequest.updateMany(
      { _id: { $in: cluster.ride_request_ids } },
      {
        status: "BOOKED_SOLO",
        batch_id: batchedRide._id,
      }
    );

    res.status(200).json(
      new ApiResponse(200, "Cluster force-batched successfully", {
        cluster_id: cluster._id,
        batch_id: batchedRide._id,
        batch_size: batchedRide.total_size,
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get clustering statistics for an office
 *
 * @route GET /api/clustering/stats/:office_id
 */
export const getClusteringStats = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { office_id } = req.params;

    const activeClusters = await Clustering.countDocuments({
      office_id,
      status: "ACTIVE",
    });

    const fullClusters = await Clustering.countDocuments({
      office_id,
      status: "FULL",
    });

    const batchedClusters = await Clustering.countDocuments({
      office_id,
      status: "BATCHED",
    });

    const pendingBatches = await BatchedRide.countDocuments({
      office_id,
      status: "PENDING",
    });

    const assignedBatches = await BatchedRide.countDocuments({
      office_id,
      status: "ASSIGNED",
    });

    const stats = {
      office_id,
      clustering: {
        active: activeClusters,
        full: fullClusters,
        batched: batchedClusters,
        total: activeClusters + fullClusters + batchedClusters,
      },
      batched: {
        pending: pendingBatches,
        assigned: assignedBatches,
        total: pendingBatches + assignedBatches,
      },
    };

    res.status(200).json(
      new ApiResponse(200, "Clustering statistics retrieved", stats)
    );
  } catch (error) {
    next(error);
  }
};
