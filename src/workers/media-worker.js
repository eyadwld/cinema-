import { Worker } from "bullmq";
import env from "../config/env.js";

import Movie from "../models/Movie.js";

import {
  uploadToCloudinary,
  deleteFromCloudinary,
} from "../utils/uploadToCloudinary.js";

const mediaWorker = new Worker(
  "media",
  async (job) => {
    console.log(`Processing job ${job.id}`);

    switch (job.name) {
      case "upload-poster": {
        const { movieId, file, folder, previousPublicId } = job.data;

        const uploaded = await uploadToCloudinary({
          fileBuffer: Buffer.from(file, "base64"),
          folder,
        });

        await Movie.findByIdAndUpdate(
          movieId,
          {
            $set: {
              posterUrl: {
                url: uploaded.secure_url,
                publicId: uploaded.public_id,
              },
            },
          },
          {
            returnDocument: "after",
          },
        );

        if (previousPublicId) {
          await deleteFromCloudinary(previousPublicId);
        }

        console.log(`Poster uploaded for movie ${movieId}`);

        break;
      }

      default:
        throw new Error(`Unknown media job: ${job.name}`);
    }
  },
  {
    connection: {
      url: env.redisUrl,
    },
  },
);

mediaWorker.on("completed", (job) => {
  console.log(`Job ${job.id} completed`);
});

mediaWorker.on("failed", (job, error) => {
  console.error(`Job ${job?.id} failed:`, error);
});

export default mediaWorker;
