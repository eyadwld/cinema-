import env from "../../config/env.js";

const splitName = (fullName = "") => {
  const parts = String(fullName).trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return { firstName: "Cinema", lastName: "Guest" };
  }

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: parts[0] };
  }

  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
};

export const buildIntentionPayload = ({ booking, user, payment }) => {
  const { firstName, lastName } = splitName(user?.name);
  const email = user?.email || "guest@example.com";
  const amount = Number(booking.totalAmountMinor);

  return {
    amount,
    currency: booking.currency || "EGP",
    payment_methods: [Number(env.paymobIntegrationId)],
    items: [
      {
        name: `Booking ${String(booking._id).slice(-8)}`,
        amount,
        description: `${booking.seatIds.length} seat(s) for showtime ${booking.showtimeId}`,
        quantity: 1,
      },
    ],
    billing_data: {
      first_name: firstName,
      last_name: lastName,
      email,
      phone_number: "+201000000000",
      street: "NA",
      building: "NA",
      floor: "NA",
      apartment: "NA",
      city: "Cairo",
      country: "EGY",
      state: "Cairo",
    },
    customer: {
      first_name: firstName,
      last_name: lastName,
      email,
    },
    extras: {
      bookingId: booking._id.toString(),
      paymentId: payment._id.toString(),
      userId: String(booking.userId),
    },
    special_reference: booking._id.toString(),
    expiration: 300,
    notification_url: env.paymobNotificationUrl,
    redirection_url: env.paymobRedirectionUrl,
    delivery_needed: false,
  };
};
