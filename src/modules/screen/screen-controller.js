import {
  createScreen,
  getCinemaScreens,
  getScreenById,
  updateScreen,
  deleteScreen,
} from "./screen-service.js";

export const create = async (req, res) => {
  const { screen, seatsGenerated } = await createScreen(req.body);

  res.status(201).json({
    success: true,
    seatsGenerated,
    data: screen,
  });
};

export const getByCinema = async (req, res) => {
  const screens = await getCinemaScreens(req.params.cinemaId);

  res.status(200).json({
    success: true,
    data: screens,
  });
};

export const getOne = async (req, res) => {
  const screen = await getScreenById(req.params.id);

  res.status(200).json({
    success: true,
    data: screen,
  });
};

export const update = async (req, res) => {
  const screen = await updateScreen(req.params.id, req.body);

  res.status(200).json({
    success: true,
    data: screen,
  });
};

export const remove = async (req, res) => {
  await deleteScreen(req.params.id);

  res.status(200).json({
    success: true,
    message: "Screen deactivated successfully",
  });
};
