import mongoose from "mongoose";

const movieSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 200,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: "",
    },

    durationMinutes: {
      type: Number,
      required: true,
      min: 1,
      max: 600,
    },

    genre: {
      type: [String],
      default: [],
    },

    language: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },

    ageRating: {
      type: String,
      trim: true,
      maxlength: 20,
      default: "NR",
    },

    posterUrl: {
      url: {
        type: String,
        required: true,
      },

      publicId: {
        type: String,
        required: true,
      },
    },

    releaseDate: {
      type: Date,
      default: null,
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

movieSchema.index({
  title: 1,
  isActive: 1,
});

const Movie = mongoose.model("Movie", movieSchema);

export default Movie;
