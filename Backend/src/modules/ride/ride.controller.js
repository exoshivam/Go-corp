import { RideRequest } from "./ride.model.js";
import { Office } from "../office/office.model.js";
import ApiResponse from "../../utils/ApiResponse.js";
import ApiError from "../../utils/ApiError.js";
import {
  isWithinOfficeHours,
  isDuplicateBooking,
  isLateRequest,
  isOneEndOffice,
  validateInvitedEmployees,
  getInvitedPeopleForRide,
  findRidesInvitingEmployee,
  getEmployeesInRideGroup,
} from "./ride.service.js";
import { clusterRides, assignClusters } from "./clustering.service.js";
import { RideBatch } from "./batch.model.js";
import { validationResult } from "express-validator";

export const bookRide = async (req, res, next) => {
  console.log("\n🚀 ===== BOOK RIDE API HIT =====");
  console.log("Body:", req.body);
  try {
    const {
      employee_id,
      office_id,
      destination_type,
      schedule_type,
      scheduled_at,
      pickup_address,
      pickup_location,
      drop_address,
      drop_location,
      solo_preference,
      invited_employee_ids = [],
    } = req.body;

    if (!employee_id || !office_id || !scheduled_at) {
      throw new ApiError(400, "Missing required fields");
    }

    // Validate invited employees
    const inviteValidation = validateInvitedEmployees(invited_employee_ids);
    if (!inviteValidation.valid) {
      throw new ApiError(400, inviteValidation.message);
    }

    // step 1 — fetch office
    const office = await Office.findById(office_id);
    if (!office) throw new ApiError(404, "Office not found");

    // step 2 — check office hours
    if (!isWithinOfficeHours(scheduled_at, office)) {
      throw new ApiError(400, "Ride request is outside office hours");
    }

    // step 3 — check duplicate booking
    if (await isDuplicateBooking(employee_id, scheduled_at)) {
      throw new ApiError(400, "Duplicate ride request for the same time");
    }

    //step 4 — check one end is office
    if (
      !isOneEndOffice(pickup_location, drop_location, office.office_location)
    ) {
      throw new ApiError(
        400,
        "Either pickup or drop location must be the office",
      );
    }

    //step 5 — check late request
    if (isLateRequest(scheduled_at)) {
      throw new ApiError(
        400,
        "Ride request must be made at least 30 minutes in advance",
      );
    }

    const isLate = isLateRequest(scheduled_at);

    const ride = await RideRequest.create({
      employee_id,
      office_id,
      destination_type,
      schedule_type,
      scheduled_at,
      pickup_address,
      pickup_location,
      drop_address,
      drop_location,
      solo_preference: isLate ? true : solo_preference, // Force solo if it's a late request
      is_late_request: isLate,
      invited_employee_ids,
      otp: Math.floor(1000 + Math.random() * 9000).toString(),
    });

    console.log("✅ Ride created:", ride._id);
console.log("👉 solo_preference:", ride.solo_preference);

    // 🔥 FINAL LOGIC

    if (ride.solo_preference) {
      // ✅ SOLO RIDE → DIRECT BATCH (NO CLUSTERING, NO OSRM)

      console.log("🧍 SOLO FLOW ENTERED - Creating batch instantly");
      console.log("  office_id:", office_id);
      console.log("  direction:", direction);
      console.log("  scheduled_at:", scheduled_at);

      try {
        const batch = await RideBatch.create({
          office_id,
          direction,
          scheduled_at,
          route_polyline: null, // optional for solo
          employee_ids: [employee_id], // Single employee for solo ride
        });

        console.log("🆕 SOLO BATCH CREATED:", batch._id);
        console.log(`👥 Employee in batch: ${employee_id}`);

        const updateResult = await RideRequest.updateOne(
          { _id: ride._id },
          {
            batch_id: batch._id,
            status: "CLUSTERED",
            pickup_order: 1,
          },
        );

        console.log("📝 Ride update result:", updateResult);
        console.log("✅ Ride status updated to CLUSTERED");
      } catch (batchError) {
        console.error("❌ ERROR creating batch or updating ride:", batchError.message);
        console.error("Stack:", batchError.stack);
        throw batchError;
      }
    } else {
      // 👥 SHARED RIDE → KEEP IN PENDING (CLUSTERING HAPPENS 10 MINS BEFORE SCHEDULED TIME)
      console.log("👥 SHARED FLOW ENTERED - Ride stored as PENDING for delayed clustering");
      console.log("📝 Ride will be clustered 10 minutes before scheduled time");
      
      // Ride already created with status: PENDING - no immediate clustering
    }

    if (ride) {
      console.log("\n--- NEW RIDE CREATED ---");
      console.log("Ride ID:", ride._id);
      console.log("Status:", ride.status);
      console.log("Scheduled At:", ride.scheduled_at);
      console.log("Pickup Location:", ride.pickup_location.coordinates);
      console.log("Direction:", ride.direction);
      res
        .status(201)
        .json(new ApiResponse(201, "Ride booked successfully", ride));
    } else {
      throw new ApiError(500, "Failed to book ride");
    }
  } catch (e) {
    next(e);
  }
};

export const getClusters = async (req, res) => {
  try {
    const { office_id, direction, scheduled_at } = req.query;
    const office = await Office.findById(office_id);

    const start = new Date(new Date(scheduled_at).getTime() - 10 * 60 * 1000);
    const end = new Date(new Date(scheduled_at).getTime() + 10 * 60 * 1000);

    const batches = await RideBatch.find({
      office_id,
      direction,
      scheduled_at: { $gte: start, $lte: end },
    });

    const rides = await RideRequest.find({
      office_id,
      direction,
      scheduled_at: { $gte: start, $lte: end },
      status: "CLUSTERED",
    });

    res.json({
      batches,
      rides,
      office,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getInvitedPeople = async (req, res, next) => {
  try {
    const { employee_id } = req.params;

    if (!employee_id) {
      throw new ApiError(400, "Employee ID is required");
    }

    // Validate employee_id format
    if (!employee_id.match(/^[0-9a-fA-F]{24}$/)) {
      throw new ApiError(400, "Invalid employee ID format");
    }

    const result = await getInvitedPeopleForRide(employee_id);

    res
      .status(200)
      .json(
        new ApiResponse(200, "Invited people retrieved successfully", result),
      );
  } catch (error) {
    next(error || new ApiError(500, "Error retrieving invited people"));
  }
};

// For clustering service: Get rides where this employee was invited
export const getRidesWithEmployeeInvite = async (req, res, next) => {
  try {
    const { employee_id, scheduled_at } = req.query;

    if (!employee_id || !scheduled_at) {
      throw new ApiError(400, "Employee ID and scheduled time are required");
    }

    const rides = await findRidesInvitingEmployee(employee_id, scheduled_at);

    res.status(200).json(
      new ApiResponse(200, "Rides with invites retrieved", {
        count: rides.length,
        rides,
      }),
    );
  } catch (error) {
    next(error || new ApiError(500, "Error retrieving rides with invites"));
  }
};

// For clustering service: Get all employees in a ride (requester + invited)
export const getRideEmployeeGroup = async (req, res, next) => {
  try {
    const { ride_id } = req.params;

    if (!ride_id) {
      throw new ApiError(400, "Ride ID is required");
    }

    const employees = await getEmployeesInRideGroup(ride_id);

    res.status(200).json(
      new ApiResponse(200, "Ride employee group retrieved", {
        total: employees.length,
        employee_ids: employees,
      }),
    );
  } catch (error) {
    next(error || new ApiError(500, "Error retrieving ride employee group"));
  }
};

export const cancelRide = async (req, res, next) => {
  try {
    const { ride_id } = req.params;
    const { cancel_reason } = req.body;

    if (!ride_id.match(/^[0-9a-fA-F]{24}$/)) {
      throw new ApiError(400, "Invalid ride ID format");
    }

    const ride = await RideRequest.findById(ride_id);
    if (!ride) throw new ApiError(404, "Ride not found");

    // Ensure the requesting user owns this ride
    if (ride.employee_id.toString() !== req.user._id.toString()) {
      throw new ApiError(403, "You are not authorized to cancel this ride");
    }

    // Only allow cancellation of PENDING or IN_CLUSTERING rides
    if (!["PENDING", "IN_CLUSTERING"].includes(ride.status)) {
      throw new ApiError(
        400,
        `Cannot cancel a ride with status: ${ride.status}`,
      );
    }

    ride.status = "CANCELLED";
    ride.cancelled_at = new Date();
    ride.cancel_reason = cancel_reason || "Cancelled by user";
    await ride.save();

    res
      .status(200)
      .json(new ApiResponse(200, "Ride cancelled successfully", ride));
  } catch (error) {
    next(error || new ApiError(500, "Error cancelling ride"));
  }
};

export const getRideById = async (req, res, next) => {
  try {
    const { ride_id } = req.params;

    if (!ride_id.match(/^[0-9a-fA-F]{24}$/)) {
      throw new ApiError(400, "Invalid ride ID format");
    }

    const ride = await RideRequest.findById(ride_id)
      .populate("employee_id", "name email profile_image")
      .populate("office_id", "name office_location shift_start shift_end")
      .populate("invited_employee_ids", "name email profile_image");

    if (!ride) throw new ApiError(404, "Ride not found");

    const route = await getRoute(
      ride.pickup_location.coordinates,
      ride.drop_location.coordinates,
    );

    res.status(200).json(
      new ApiResponse(200, "Ride retrieved successfully", {
        ...ride.toObject(),
        route,
      }),
    );
  } catch (error) {
    next(error || new ApiError(500, "Error retrieving ride"));
  }
};

export const getPendingRides = async (req, res, next) => {
  try {
    const { latitude, longitude } = req.query;

    // Validate location coordinates
    if (!latitude || !longitude) {
      throw new ApiError(
        400,
        "Driver location (latitude, longitude) is required",
      );
    }

    const driverLat = parseFloat(latitude);
    const driverLng = parseFloat(longitude);

    // Validate parsed coordinates
    if (isNaN(driverLat) || isNaN(driverLng)) {
      throw new ApiError(400, "Invalid latitude or longitude values");
    }

    // Validate coordinate ranges
    if (
      driverLat < -90 ||
      driverLat > 90 ||
      driverLng < -180 ||
      driverLng > 180
    ) {
      throw new ApiError(400, "Invalid coordinate ranges");
    }

    const now = new Date();
    const fifteenMinutesLater = new Date(now.getTime() + 15 * 60000);
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60000);
    const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60000); // 2 hours for more flexibility

    console.log(`\n🔍 === SEARCHING FOR RIDES ===`);
    console.log(`🔍 Driver Location: [${driverLat}, ${driverLng}]`);
    console.log(`🔍 Current Time: ${now.toISOString()}`);
    console.log(
      `🔍 Time Window: ${fifteenMinutesAgo.toISOString()} to ${twoHoursLater.toISOString()}`,
    );

    // First, check total rides in database
    const totalRides = await RideRequest.countDocuments({});
    console.log(`📊 Total rides in database: ${totalRides}`);

    // Check pending rides
    const pendingRides = await RideRequest.countDocuments({
      status: "PENDING",
    });
    console.log(`📊 PENDING rides in database: ${pendingRides}`);

    // Check all ride statuses
    const allStatuses = await RideRequest.distinct("status");
    console.log(`📊 Available statuses in database:`, allStatuses);

    // Get all PENDING rides (regardless of time) for debugging
    const allPendingRidesDebug = await RideRequest.find({
      status: "PENDING",
    }).lean();
    console.log(
      `📊 All PENDING rides (any time): ${allPendingRidesDebug.length}`,
    );
    if (allPendingRidesDebug.length > 0) {
      allPendingRidesDebug.forEach((ride) => {
        const timeDiff = ride.scheduled_at
          ? ride.scheduled_at.getTime() - now.getTime()
          : null;
        console.log(
          `  - Ride ${ride._id}: scheduled_at="${ride.scheduled_at}", timeDiff=${timeDiff}ms (${(timeDiff / 60000).toFixed(1)} min)`,
        );
      });
    }

    // Get all pending rides matching time criteria
    const allPendingRides = await RideRequest.find({
      status: "PENDING",
      $or: [
        // Instant rides (scheduled_at is in the past)
        {
          scheduled_at: { $lt: now },
        },
        // Scheduled rides (show from 15 minutes before to 2 hours ahead)
        {
          scheduled_at: {
            $gte: fifteenMinutesAgo,
            $lte: twoHoursLater,
          },
        },
      ],
    })
      .populate("employee_id", "name email contact")
      .populate("office_id", "office_name office_location")
      .lean();

    console.log(
      `📍 Found ${allPendingRides.length} pending rides matching time criteria`,
    );

    if (allPendingRides.length > 0) {
      allPendingRides.forEach((ride) => {
        console.log(
          `  - Ride ${ride._id}: scheduled_at=${ride.scheduled_at.toISOString()}, pickup=[${ride.pickup_location.coordinates}]`,
        );
      });
    }

    // Helper function to calculate distance between two coordinates (Haversine formula)
    const calculateDistance = (lat1, lon1, lat2, lon2) => {
      const R = 6371; // Earth's radius in kilometers
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distanceKm = R * c;
      return distanceKm;
    };

    // Filter rides within 3 km
    const nearbyRides = allPendingRides.filter((ride) => {
      if (
        !ride.pickup_location ||
        !ride.pickup_location.coordinates ||
        ride.pickup_location.coordinates.length < 2
      ) {
        console.warn(
          `⚠️ Ride ${ride._id} has invalid pickup_location:`,
          ride.pickup_location,
        );
        return false;
      }

      // Coordinates in database should be [longitude, latitude]
      const [pickupLng, pickupLat] = ride.pickup_location.coordinates;

      const distanceKm = calculateDistance(
        driverLat,
        driverLng,
        pickupLat,
        pickupLng,
      );

      console.log(
        `📌 Ride ${ride._id}: Distance = ${distanceKm.toFixed(2)} km, Pickup: [${pickupLat}, ${pickupLng}]`,
      );

      // Return true if distance is less than 3 km
      return distanceKm <= 3;
    });

    console.log(`✅ Found ${nearbyRides.length} rides within 3 km`);

    if (nearbyRides.length === 0) {
      return res
        .status(200)
        .json(new ApiResponse(200, "No pending rides available nearby", null));
    }

    // Return the first ride (sorted by scheduled_at)
    const closestRide = nearbyRides.sort((a, b) => {
      const aTime = a.scheduled_at
        ? new Date(a.scheduled_at).getTime()
        : now.getTime();
      const bTime = b.scheduled_at
        ? new Date(b.scheduled_at).getTime()
        : now.getTime();
      return aTime - bTime;
    })[0];

    console.log(`🎯 Sending ride ${closestRide._id} to driver`);

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          "Pending rides retrieved successfully",
          closestRide,
        ),
      );
  } catch (e) {
    console.error("❌ Error in getPendingRides:", e);
    next(e);
  }
};

export const getPendingBatches = async (req, res, next) => {
  try {
    const { latitude, longitude } = req.query;

    console.log(`\n🔍 === SEARCHING FOR BATCHES (NO CONSTRAINTS - TEST MODE) ===`);
    console.log(`🔍 Driver Location: [${latitude}, ${longitude}]`);

    // Get ALL available batches (no time constraints for testing)
    const allBatches = await RideBatch.find({})
      .populate("employee_ids", "name email phone_number profile_image")
      .populate("office_id", "office_name office_location")
      .sort({ scheduled_at: -1 })
      .lean();

    console.log(`📊 Found ${allBatches.length} total batches in database`);

    if (allBatches.length === 0) {
      return res
        .status(200)
        .json(
          new ApiResponse(200, "No batches available", null),
        );
    }

    // Find batch with most employees (for showing full route)
    let selectedBatch = allBatches[0];
    let maxEmployees = selectedBatch.employee_ids?.length || 0;

    for (const batch of allBatches) {
      const empCount = batch.employee_ids?.length || 0;
      if (empCount > maxEmployees) {
        selectedBatch = batch;
        maxEmployees = empCount;
      }
    }

    // Get all rides in this batch to include in response
    const batchRides = await RideRequest.find({ batch_id: selectedBatch._id })
      .sort("pickup_order")
      .lean();

    console.log(
      `🎯 Sending batch ${selectedBatch._id} with ${selectedBatch.employee_ids?.length || 0} employees to driver`,
    );

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          "Pending batches retrieved successfully",
          {
            ...selectedBatch,
            rides: batchRides,
          },
        ),
      );
  } catch (e) {
    console.error("❌ Error in getPendingBatches:", e);
    next(e);
  }
};

export const verifyOTP = async (req, res, next) => {
  try {
    const { ride_id, otp } = req.body;

    if (!ride_id || !otp) {
      throw new ApiError(400, "Ride ID and OTP are required");
    }

    if (!ride_id.match(/^[0-9a-fA-F]{24}$/)) {
      throw new ApiError(400, "Invalid ride ID format");
    }

    const ride = await RideRequest.findById(ride_id);
    if (!ride) {
      throw new ApiError(404, "Ride not found");
    }

    // Compare the entered OTP with the stored OTP
    if (ride.otp !== otp) {
      throw new ApiError(401, "Invalid OTP");
    }

    // OTP verified successfully
    res.status(200).json(
      new ApiResponse(200, "OTP verified successfully", {
        ride_id: ride._id,
        status: ride.status,
      }),
    );
  } catch (error) {
    next(error || new ApiError(500, "Error verifying OTP"));
  }
};

export const testClusterRides = async (req, res, next) => {
  try {
    console.log("\n🧪 ===== MANUAL CLUSTERING TEST TRIGGERED =====");

    // Get all PENDING shared rides (regardless of time)
    const pendingRides = await RideRequest.find({
      status: "PENDING",
      solo_preference: false,
    }).lean();

    console.log(`📊 Found ${pendingRides.length} pending shared rides`);

    if (pendingRides.length === 0) {
      return res.status(200).json(
        new ApiResponse(200, "No pending rides to cluster", {
          processedGroups: 0,
          totalRidesClustered: 0,
        }),
      );
    }

    // Group rides by (office_id, direction, scheduled_at_window) to cluster together
    // Round timestamp to 5-minute window to group similar times
    const ridesByGroup = {};

    for (const ride of pendingRides) {
      // Round to 5-minute window (5 mins = 300,000 ms)
      const GROUPING_WINDOW = 5 * 60 * 1000; // 5 minutes
      const timeWindow = Math.floor(ride.scheduled_at.getTime() / GROUPING_WINDOW) * GROUPING_WINDOW;
      
      const key = `${ride.office_id}_${ride.destination_type}_${timeWindow}`;

      if (!ridesByGroup[key]) {
        ridesByGroup[key] = {
          office_id: ride.office_id,
          destination_type: ride.destination_type,
          scheduled_at: ride.scheduled_at,
          rides: [],
        };
      }

      ridesByGroup[key].rides.push(ride);
    }

    console.log(`📦 Grouped into ${Object.keys(ridesByGroup).length} groups`);

    let totalClustered = 0;
    const results = [];

    // Process each group
    for (const groupKey in ridesByGroup) {
      const group = ridesByGroup[groupKey];

      console.log(
        `\n⏰ CLUSTERING TEST: ${group.rides.length} rides for ${group.scheduled_at.toISOString()}`,
      );

      try {
        // Cluster the rides
        console.log("📦 Calling clusterRides...");
        let clusters = await clusterRides({
          office_id: group.office_id,
          direction: group.destination_type,
          scheduled_at: group.scheduled_at,
        });

        console.log(`📊 Clusters formed: ${clusters?.length}`);

        if (!clusters || clusters.length === 0) {
          console.log("⚠️ No clusters formed → creating solo clusters");
          clusters = group.rides.map((ride) => [ride]);
        }

        // Assign clusters to batches
        console.log("🔄 Assigning clusters to batches...");
        await assignClusters(clusters, {
          office_id: group.office_id,
          direction: group.destination_type,
          scheduled_at: group.scheduled_at,
        });

        console.log(`✅ Clustering completed for ${group.scheduled_at.toISOString()}`);

        totalClustered += group.rides.length;

        results.push({
          scheduledAt: group.scheduled_at,
          rideCount: group.rides.length,
          clusterCount: clusters.length,
          status: "SUCCESS",
        });
      } catch (clusterError) {
        console.error(`❌ Error clustering rides for ${groupKey}:`, clusterError.message);

        results.push({
          scheduledAt: group.scheduled_at,
          rideCount: group.rides.length,
          status: "ERROR",
          error: clusterError.message,
        });
      }
    }

    console.log(`\n✅ Manual clustering test completed`);
    console.log(`📊 Total groups processed: ${Object.keys(ridesByGroup).length}`);
    console.log(`📊 Total rides clustered: ${totalClustered}`);

    res.status(200).json(
      new ApiResponse(200, "Clustering test completed successfully", {
        processedGroups: Object.keys(ridesByGroup).length,
        totalRidesClustered: totalClustered,
        results,
      }),
    );
  } catch (error) {
    console.error("❌ Error in testClusterRides:", error.message);
    next(error || new ApiError(500, "Error in test clustering"));
  }
};

export const getAllBatches = async (req, res, next) => {
  try {
    const batches = await RideBatch.find({})
      .populate("employee_ids", "name email phone_number profile_image")
      .populate("office_id", "office_name office_location")
      .sort({ scheduled_at: -1 })
      .lean();

    console.log(`📊 Found ${batches.length} total batches in database`);

    // Get ride details for each batch
    const batchesWithRides = await Promise.all(
      batches.map(async (batch) => {
        const rides = await RideRequest.find({ batch_id: batch._id })
          .sort("pickup_order")
          .lean();

        return {
          ...batch,
          rides,
          employeeCount: batch.employee_ids?.length || 0,
          rideCount: rides.length,
        };
      }),
    );

    res.status(200).json(
      new ApiResponse(200, "All batches retrieved successfully", batchesWithRides),
    );
  } catch (error) {
    console.error("❌ Error in getAllBatches:", error.message);
    next(error || new ApiError(500, "Error retrieving all batches"));
  }
};

export const cleanupTestData = async (req, res, next) => {
  try {
    console.log("\n🧹 ===== CLEANUP TEST DATA =====");

    const deletedRides = await RideRequest.deleteMany({});
    const deletedBatches = await RideBatch.deleteMany({});

    console.log(`🗑️ Deleted ${deletedRides.deletedCount} rides`);
    console.log(`🗑️ Deleted ${deletedBatches.deletedCount} batches`);

    res.status(200).json(
      new ApiResponse(200, "Test data cleaned up successfully", {
        deletedRides: deletedRides.deletedCount,
        deletedBatches: deletedBatches.deletedCount,
      }),
    );
  } catch (error) {
    console.error("❌ Error in cleanupTestData:", error.message);
    next(error || new ApiError(500, "Error cleaning up test data"));
  }
};

export const getRoute = async (req, res, next) => {
  try {
    const { startLat, startLng, endLat, endLng } = req.query;

    // Validate coordinates
    if (!startLat || !startLng || !endLat || !endLng) {
      throw new ApiError(
        400,
        "Missing coordinates: startLat, startLng, endLat, endLng required",
      );
    }

    console.log(
      `📍 Fetching route from backend: (${startLat}, ${startLng}) → (${endLat}, ${endLng})`,
    );

    // Call OSRM API from backend with retry logic
    const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;

    console.log(`🌐 OSRM URL: ${url}`);

    let lastError = null;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Route fetch attempt ${attempt}/${maxRetries}...`);

        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

        const response = await fetch(url, {
          method: "GET",
          headers: {
            "User-Agent": "GoCorp-Driver-App/1.0",
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`OSRM returned ${response.status}`);
        }

        const data = await response.json();

        if (!data.routes || data.routes.length === 0) {
          throw new Error("No routes found in response");
        }

        const route = data.routes[0];
        console.log(
          `✅ Route loaded: ${(route.distance / 1000).toFixed(2)} km, ${(route.duration / 60).toFixed(0)} minutes`,
        );

        // Convert coordinates [lng, lat] to [lat, lng] for frontend
        const coordinates = route.geometry.coordinates.map(([lng, lat]) => [
          lat,
          lng,
        ]);

        res.status(200).json(
          new ApiResponse(200, "Route retrieved successfully", {
            coordinates,
            distance: route.distance,
            duration: route.duration,
          }),
        );

        return; // Success - exit function
      } catch (attemptError) {
        console.error(`❌ Attempt ${attempt} failed:`, attemptError.message);
        lastError = attemptError;

        if (attempt < maxRetries) {
          // Wait before retrying (exponential backoff)
          const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          console.log(`⏳ Waiting ${waitTime}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }
    }

    // All retries failed
    console.error("❌ All route fetch attempts failed:", lastError.message);
    throw new ApiError(
      503,
      `Failed to fetch route after ${maxRetries} attempts: ${lastError.message}`,
    );
  } catch (e) {
    console.error("❌ Error in getRoute:", e.message);
    next(e);
  }
};
