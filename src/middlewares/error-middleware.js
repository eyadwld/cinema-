const errorMiddleware = (error, req, res, next) => {
  const success = error.success || false;
  const message = error.message || "Server Error";
  const status = error.statusCode || 500;

  console.error(error);

  res.status(status).json({
    success,
    message,
  });
};

export default errorMiddleware;
