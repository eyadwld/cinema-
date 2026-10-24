import Movie from "../../models/Movie.js";
import AppError from "../../utils/appError.js";

import mediaQueue from "../../queues/media-queue.js";

export const createMovie = async (data, file) => {
  if (!file) {
    throw new AppError("Image Cover is required", 400);
  }

  const genre = data.genre ?? data["genre[]"];
  const normalizedGenre =
    genre === undefined ? undefined : Array.isArray(genre) ? genre : [genre];

  const { posterUrl: _ignoredPoster, "genre[]": _ignoredGenre, ...rest } = data;

  const movie = await Movie.create({
    ...rest,
    genre: normalizedGenre,
  });

  /*
   * The poster is uploaded in the background, the movie is
   * returned with an empty poster until the job lands.
   */

  await mediaQueue.add(
    "upload-poster",
    {
      movieId: movie._id.toString(),
      file: file.buffer.toString("base64"),
      folder: "cinema/posters",
      previousPublicId: null,
    },
    {
      jobId: `poster-${movie._id}`,
    },
  );

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

    /*
     * The poster is uploaded in the background, the previous
     * poster is deleted once the new one lands.
     */

    await mediaQueue.add(
      "upload-poster",
      {
        movieId: movieId.toString(),
        file: file.buffer.toString("base64"),
        folder: "cinema/posters",
        previousPublicId: previous?.posterUrl?.publicId ?? null,
      },
      {
        jobId: `poster-${movieId}-${Date.now()}`,
      },
    );
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
