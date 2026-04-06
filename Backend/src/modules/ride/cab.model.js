import mongoose from "mongoose";

const cabSchema = new mongoose.Schema({
  office_id: mongoose.Schema.Types.ObjectId,

  current_location: {
    type: {
      type: String,
      default: "Point"
    },
    coordinates: [Number]
  },

  route_polyline: Object,

  passengers: [
    {
      ride_id: mongoose.Schema.Types.ObjectId,
      pickup_order: Number
    }
  ],

  available_seats: {
    type: Number,
    default: 4
  },

  status: {
    type: String,
    enum: ["ACTIVE", "FULL", "COMPLETED"],
    default: "ACTIVE"
  }

}, { timestamps: true });

cabSchema.index({ current_location: "2dsphere" });

export const Cab = mongoose.model("Cab", cabSchema);