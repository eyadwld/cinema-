import mongoose from "mongoose";

const seatSchema = new mongoose.Schema(
  {
    screenId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Screen",
      required: true,
      index: true,
    },

    row: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 5,
    },

    number: {
      type: Number,
      required: true,
      min: 1,
      max: 100,
    },

    type: {
      type: String,
      enum: ["STANDARD", "PREMIUM", "VIP"],
      default: "STANDARD",
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

seatSchema.index(
  {
    screenId: 1,
    row: 1,
    number: 1,
  },
  {
    unique: true,
  },
);

const Seat = mongoose.model("Seat", seatSchema);

export default Seat;
