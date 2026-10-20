import Movie from "../../models/Movie.js";
import AppError from "../../utils/appError.js";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
} from "../../utils/uploadToCloudinary.js";

export const createMovie = async (data, file) => {
  if (!file) {
    throw new AppError("Image Cover is required", 400);
  }

  let uploaded;

  try {
    uploaded = await uploadToCloudinary({
      fileBuffer: file.buffer,
      folder: "cinema/posters",
    });
  } catch {
    throw new AppError("Poster upload failed", 502);
  }

  const genre = data.genre ?? data["genre[]"];
  const normalizedGenre =
    genre === undefined ? undefined : Array.isArray(genre) ? genre : [genre];

  const { posterUrl: _ignoredPoster, "genre[]": _ignoredGenre, ...rest } = data;

  const movie = await Movie.create({
    ...rest,
    genre: normalizedGenre,
    posterUrl: {
      url: uploaded.secure_url,
      publicId: uploaded.public_id,
    },
  });

  return movie;
};

export const getMovies = async () => {
  return Movie.find({
    isActive: true,
  })
    .sort({
      releaseDate: -1,
      createdAt: -1,
    })
    .lean();
};

export const getMovieById = async (movieId) => {
  const movie = await Movie.findOne({
    _id: movieId,
    isActive: true,
  }).lean();

  if (!movie) {
    throw new AppError("Movie not found", 404);
  }

  return movie;
};

export const updateMovie = async (movieId, updates, file) => {
  const allowedUpdates = {};

  const fields = [
    "title",
    "description",
    "durationMinutes",
    "language",
    "ageRating",
    "releaseDate",
    "isActive",
  ];

  for (const field of fields) {
    if (updates[field] !== undefined) {
      allowedUpdates[field] = updates[field];
    }
  }

  if (updates.genre !== undefined) {
    const genre = updates.genre;

    allowedUpdates.genre =
      genre === undefined ? undefined : Array.isArray(genre) ? genre : [genre];
  }

  if (file !== undefined) {
    const previous =
      updates.posterUrl === undefined ? await getMovieById(movieId) : null;

    try {
      const uploaded = await uploadToCloudinary({
        fileBuffer: file.buffer,
        folder: "cinema/posters",
      });

      allowedUpdates.posterUrl = {
        url: uploaded.secure_url,
        publicId: uploaded.public_id,
      };
    } catch {
      throw new AppError("Poster upload failed", 502);
    }

    if (previous?.posterUrl?.publicId) {
      deleteFromCloudinary(previous.posterUrl.publicId);
    }
  }

  const movie = await Movie.findByIdAndUpdate(
    movieId,
    {
      $set: allowedUpdates,
    },
    {
      returnDocument: "after",
      runValidators: true,
    },
  );

  if (!movie) {
    throw new AppError("Movie not found", 404);
  }

  return movie;
};

export const deleteMovie = async (movieId) => {
  const movie = await Movie.findByIdAndUpdate(
    movieId,
    {
      $set: {
        isActive: false,
      },
    },
    {
      returnDocument: "after",
    },
  );

  if (!movie) {
    throw new AppError("Movie not found", 404);
  }

  return movie;
};
