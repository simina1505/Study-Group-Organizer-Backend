import mongoose from "mongoose";

const SubjectSchema = new mongoose.Schema({
  key: { type: String, required: true },
  value: { type: String, required: true },
});

const Subject = mongoose.model("Subject", SubjectSchema);

export default Subject;
