import {
  createMovie,
  getMovies,
  getMovieById,
  deleteMovie,
  updateMovie,
} from "./movies-service.js";

import AppError from "../../utils/appError.js";

import uploadToCloudinary, {
  deleteFromCloudinary,
} from "../../utils/uploadToCloudinary.js";

export const create = async (req, res) => {
  const movie = await createMovie(req.body, req.file);

  res.status(201).json({
    success: true,
    data: movie,
  });
};

export const getAll = async (req, res) => {
  const movies = await getMovies();

  res.status(200).json({
    success: true,
    data: movies,
  });
};

export const getOne = async (req, res) => {
  const movie = await getMovieById(req.params.id);

  res.status(200).json({
    success: true,
    data: movie,
  });
};

export const update = async (req, res) => {
  if (req.file) {
    const previous =
      req.body.posterUrl === undefined
        ? await getMovieById(req.params.id)
        : null;

    try {
      const uploaded = await uploadToCloudinary({
        fileBuffer: req.file.buffer,
        folder: "cinema/posters",
      });

      req.body.posterUrl = {
        url: uploaded.secure_url,
        publicId: uploaded.public_id,
      };
    } catch {
      throw new AppError("Poster upload failed", 502);
    }

    if (previous?.posterUrl?.publicId) {
      deleteFromCloudinary(previous.posterUrl.publicId).catch(() => {});
    }
  }

  const movie = await updateMovie(req.params.id, req.body);

  res.status(200).json({
    success: true,
    data: movie,
  });
};

export const remove = async (req, res) => {
  await deleteMovie(req.params.id);

  res.status(200).json({
    success: true,
    message: "Movie deactivated successfully",
  });
};
