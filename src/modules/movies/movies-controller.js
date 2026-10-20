import {
  createMovie,
  getMovies,
  getMovieById,
  deleteMovie,
  updateMovie,
} from "./movies-service.js";

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
  const movie = await updateMovie(req.params.id, req.body, req.file);

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
