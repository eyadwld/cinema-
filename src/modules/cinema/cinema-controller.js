import {
  createCinema,
  getCinemas,
  getCinemaById,
  updateCinema,
  deleteCinema,
} from "./cinema-service.js";

export const create = async (req, res) => {
  const cinema = await createCinema(req.body);

  res.status(201).json({
    success: true,
    data: cinema,
  });
};

export const getAll = async (req, res) => {
  const cinemas = await getCinemas();

  res.status(200).json({
    success: true,
    data: cinemas,
  });
};

export const getOne = async (req, res) => {
  const cinema = await getCinemaById(req.params.id);

  res.status(200).json({
    success: true,
    data: cinema,
  });
};

export const update = async (req, res) => {
  const cinema = await updateCinema(req.params.id, req.body);

  res.status(200).json({
    success: true,
    data: cinema,
  });
};

export const remove = async (req, res) => {
  await deleteCinema(req.params.id);

  res.status(200).json({
    success: true,
    message: "Cinema deactivated successfully",
  });
};
