import mongoose from "mongoose";

const screenSchema = new mongoose.Schema(
  {
    cinemaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cinema",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 100,
    },

    rows: {
      type: Number,
      required: true,
      min: 1,
      max: 100,
    },

    columns: {
      type: Number,
      required: true,
      min: 1,
      max: 100,
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

screenSchema.index(
  {
    cinemaId: 1,
    name: 1,
  },
  {
    unique: true,
  },
);

const Screen = mongoose.model("Screen", screenSchema);

export default Screen;
