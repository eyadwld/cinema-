import { validationResult } from "express-validator";
import AppError from "../utils/appError.js";

const validate = (validations) => async (req, _res, next) => {
  await Promise.all(validations.map((validator) => validator.run(req)));

  const errors = validationResult(req);

  if (errors.isEmpty()) return next();

  next(new AppError(errors.array()[0].msg, 400));
};

export default validate;
