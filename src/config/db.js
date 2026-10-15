import mongoose from "mongoose";
import env from "./env.js";

const connectToDB = async () => {
  await mongoose.connect(env.mongoUrl);
  console.log("Connected to MongoDB");
};

export default connectToDB;
