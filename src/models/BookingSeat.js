import mongoose from "mongoose";

const bookingSeatSchema = new mongoose.Schema(
  {
    showtimeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Showtime",
      required: true,
    },
    seatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seat",
      required: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },
  },
  { timestamps: true },
);

bookingSeatSchema.index({ showtimeId: 1, seatId: 1 }, { unique: true });

bookingSeatSchema.index({ bookingId: 1 });

export default mongoose.model("BookingSeat", bookingSeatSchema);
