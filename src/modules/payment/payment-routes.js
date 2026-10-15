import { Router } from "express";
import * as controller from "./payment-controller.js";
import { requireAuth } from "../../middlewares/is-auth.js";
import validate from "../../middlewares/validation.js";
import { getPaymentValidator, initiatePaymentValidator } from "./payment-validator.js";

const router = Router();

router.post("/bookings/:bookingId/payments", requireAuth, validate(initiatePaymentValidator), controller.initiate);

router.get("/payments/:paymentId", requireAuth, validate(getPaymentValidator), controller.getOne);

router.post("/payments/paymob/webhook", controller.webhook);

export default router;
