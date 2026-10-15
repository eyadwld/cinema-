import mongoose from "mongoose";

const cinemaSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 150,
    },

    city: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    address: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
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

cinemaSchema.index({
  city: 1,
  isActive: 1,
});

const Cinema = mongoose.model("Cinema", cinemaSchema);

export default Cinema;
