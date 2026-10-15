import multer from "multer";
import AppError from "../utils/appError.js";

const storage = multer.memoryStorage(); // this code sets up a memory storage engine for multer, which means that uploaded files will be stored in memory as Buffer objects rather than being saved to disk. This is useful for scenarios where you want to process the file immediately after upload, such as uploading it to a cloud storage service like Cloudinary.

const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError("Only JPEG, PNG, WEBP and JPG images are allowed", 400), false);
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
}); // this code creates a multer instance with the specified storage engine, file filter, and file size limit. The `upload` middleware can be used in routes to handle file uploads, ensuring that only allowed file types are accepted and that the file size does not exceed the specified limit.

export default upload;
