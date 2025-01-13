import mongoose from "mongoose";

const FileSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
    fileName: { type: String, required: true },
    // contentType: { type: String, required: true },
    fileData: { type: mongoose.Schema.Types.ObjectId, ref: "fs.files" },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true },
  { collection: "Files" }
);

const File = mongoose.model("Files", FileSchema);

export default File;
