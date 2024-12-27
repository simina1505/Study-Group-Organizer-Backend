import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Groups",
      required: true,
    },

    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true },
  { collection: "Messages" }
);

const Message = mongoose.model("Messages", MessageSchema);

export default Message;
