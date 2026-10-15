import {
  createShowtime,
  getShowtimeById,
  getShowtimes,
  updateShowtime,
  deleteShowtime,
  getShowtimeSeats,
  acquireSeatLocks,
  releaseSeatLocks,
} from "./showtime-service.js";

export const create = async (req, res) => {
  const showtime = await createShowtime(req.body);

  res.status(201).json({
    success: true,
    data: showtime,
  });
};

export const getAll = async (req, res) => {
  const showtimes = await getShowtimes({
    movieId: req.query.movieId,
    screenId: req.query.screenId,
    cinemaId: req.query.cinemaId,
    from: req.query.from,
    to: req.query.to,
  });

  res.status(200).json({
    success: true,
    results: showtimes.length,
    data: { showtimes },
  });
};

export const getOne = async (req, res) => {
  const showtime = await getShowtimeById(req.params.id);

  res.status(200).json({
    success: true,
    data: { showtime },
  });
};

export const update = async (req, res) => {
  const showtime = await updateShowtime(req.params.id, req.body);

  res.status(200).json({
    success: true,
    data: { showtime },
  });
};

export const remove = async (req, res) => {
  await deleteShowtime(req.params.id);

  res.status(200).json({
    success: true,
    message: "Showtime deactivated successfully",
  });
};

export const getSeats = async (req, res) => {
  const result = await getShowtimeSeats(req.params.id);

  res.status(200).json({
    success: true,
    data: result,
  });
};

export const lockSeats = async (req, res) => {
  const result = await acquireSeatLocks({
    showtimeId: req.params.id,
    seatIds: req.body.seatIds,
    userId: req.auth.userId,
  });

  res.status(200).json({
    success: true,
    message: "Seats locked temporarily",
    data: result,
  });
};

export const unlockSeats = async (req, res) => {
  const result = await releaseSeatLocks({
    showtimeId: req.params.id,
    seatIds: req.body.seatIds,
    userId: req.auth.userId,
    lockToken: req.body.lockToken,
  });

  res.status(200).json({
    success: true,
    message: "Seat lock release processed",
    data: result,
  });
};
