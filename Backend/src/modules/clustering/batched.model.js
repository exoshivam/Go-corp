import mongoose from "mongoose";

const batchedRideSchema = new mongoose.Schema(
  {
    office_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Office",
      required: true,
      index: true,
    },

    // Array of ride request IDs in this batch
    ride_request_ids: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "RideRequest",
        required: true,
      },
    ],

    // Total number of passengers
    total_size: {
      type: Number,
      required: true,
      min: 1,
      max: 4,
    },

    // Scheduled time
    scheduled_at: {
      type: Date,
      required: true,
      index: true,
    },

    // Pickup location (GeoJSON Point)
    pickup_location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [lng, lat]
        required: true,
      },
    },

    // Drop location (GeoJSON Point)
    drop_location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [lng, lat]
        required: true,
      },
    },

    // Route polyline (array of [lng, lat] coordinates)
    route_polyline: {
      type: [
        {
          type: [Number],
        },
      ],
      default: [],
    },

    // Pickup order for each ride
    pickup_order: {
      type: Map,
      of: Number, // Map of ride_id -> pickup_order
      default: new Map(),
    },

    // Status of the batch
    status: {
      type: String,
      enum: ["PENDING", "ASSIGNED", "ACCEPTED", "IN_TRANSIT", "COMPLETED", "CANCELLED"],
      default: "PENDING",
      index: true,
    },

    // Assigned driver
    driver_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
    },

    // Reference to original clustering entry (if this was moved from clustering)
    clustering_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Clustering",
    },

    // How this batch was created
    batch_reason: {
      type: String,
      enum: ["SOLO", "FORCE_BATCH", "FULL_SIZE", "REACHED_SIZE_4"],
      default: "FULL_SIZE",
    },

    // When batch was created
    created_at: {
      type: Date,
      default: Date.now,
    },

    // When batch was assigned to a driver
    assigned_at: Date,

    // Metadata
    metadata: {
      Notes: String,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// Indexes for querying
batchedRideSchema.index({ office_id: 1, status: 1, scheduled_at: 1 });
batchedRideSchema.index({ office_id: 1, scheduled_at: 1 });
batchedRideSchema.index({ status: 1 });
batchedRideSchema.index({ driver_id: 1 });

export const BatchedRide = mongoose.model("BatchedRide", batchedRideSchema);
