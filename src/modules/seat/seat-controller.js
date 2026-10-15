import {
  generateSeats,
  getScreenSeats,
  updateSeat,
  deleteSeat,
} from "./seat-service.js";

export const generate = async (req, res) => {
  const seats = await generateSeats(req.params.screenId);

  res.status(201).json({
    success: true,
    count: seats.length,
    data: seats,
  });
};

export const getByScreen = async (req, res) => {
  const seats = await getScreenSeats(req.params.screenId);

  res.status(200).json({
    success: true,
    count: seats.length,
    data: seats,
  });
};

export const update = async (req, res) => {
  const seat = await updateSeat(req.params.id, req.body);

  res.status(200).json({
    success: true,
    data: seat,
  });
};

export const remove = async (req, res) => {
  await deleteSeat(req.params.id);

  res.status(200).json({
    success: true,
    message: "Seat deactivated successfully",
  });
};
