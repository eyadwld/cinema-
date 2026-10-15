import cloudinary from "../config/cloudinary.js";

export const uploadToCloudinary = ({ fileBuffer, folder }) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        unique_filename: true,
        overwrite: false,
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      },
    );
    uploadStream.end(fileBuffer);
  });
}; // this function takes a file buffe and a folder name as input, and returns a promise that resolves with the result of the upload to Cloudinary. It uses the Cloudinary SDK's `upload_stream` method to handle the upload process. If the upload is successful, it resolves the promise with the result; if there's an error, it rejects the promise with the error.

//note: fileBuffer is the binary data of the file to be uploaded, and folder is the name of the folder in Cloudinary where the file will be stored.

export const deleteFromCloudinary = (publicId) => {
  if (!publicId) return Promise.resolve(null);

  return cloudinary.uploader.destroy(publicId);
};

export default uploadToCloudinary;
