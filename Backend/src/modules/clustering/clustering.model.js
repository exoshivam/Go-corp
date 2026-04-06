import mongoose from "mongoose";

const clusteringSchema = new mongoose.Schema(
  {
    office_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Office",
      required: true,
      index: true,
    },

    // Array of ride request IDs that form this cluster
    ride_request_ids: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "RideRequest",
        required: true,
      },
    ],

    // Total group size (sum of all individual group sizes)
    // E.g., if cluster has [solo, pair], total_size = 3
    total_size: {
      type: Number,
      required: true,
      min: 1,
      max: 4,
      validate: {
        validator: function (v) {
          return v <= 4;
        },
        message: "Cluster total size cannot exceed 4 passengers",
      },
    },

    // The scheduled time for this cluster (all rides should be within time window)
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

    // Polyline representing the route (array of [lng, lat] coordinates)
    route_polyline: {
      type: [
        {
          type: [Number],
        },
      ],
      default: [],
    },

    // Pickup order for each ride (which position in the route)
    pickup_order: {
      type: Map,
      of: Number, // Map of ride_id -> pickup_order
      default: new Map(),
    },

    // Status of the cluster
    status: {
      type: String,
      enum: ["ACTIVE", "FULL", "BATCHED", "CANCELLED"],
      default: "ACTIVE",
      index: true,
    },

    // Reference to batched ride if it has been moved to Batched
    batch_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BatchedRide",
    },

    // Timestamp when cluster was created
    created_at: {
      type: Date,
      default: Date.now,
    },

    // Timestamp when cluster was last updated
    updated_at: {
      type: Date,
      default: Date.now,
    },

    // Notes/metadata for debugging
    metadata: {
      reason_for_clustering: String, // e.g., "Similar pickup + drop", "Polyline route buffer match"
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// Indexes for querying
clusteringSchema.index({ office_id: 1, status: 1, scheduled_at: 1 });
clusteringSchema.index({ office_id: 1, scheduled_at: 1 });
clusteringSchema.index({ pickup_location: "2dsphere" });
clusteringSchema.index({ status: 1, scheduled_at: 1 }); // For force-batch job

export const Clustering = mongoose.model("Clustering", clusteringSchema);
