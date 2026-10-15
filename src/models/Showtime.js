import mongoose from "mongoose";

const showtimeSchema = new mongoose.Schema(
  {
    movieId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Movie",
      required: true,
      index: true,
    },

    screenId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Screen",
      required: true,
      index: true,
    },

    startsAt: {
      type: Date,
      required: true,
      index: true,
    },

    endsAt: {
      type: Date,
      required: true,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
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

showtimeSchema.index({
  screenId: 1,
  startsAt: 1,
});

showtimeSchema.index({
  movieId: 1,
  startsAt: 1,
});

const Showtime = mongoose.model("Showtime", showtimeSchema);

export default Showtime;
