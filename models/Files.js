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
    fileName: { type: String, required: true }, // File name
    // contentType: { type: String, required: true }, // MIME type (e.g., image/jpeg, application/pdf)
    fileData: { type: Buffer, required: true }, // File content stored as a binary blob
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true },
  { collection: "Files" }
);

const File = mongoose.model("Files", FileSchema);

export default File;
