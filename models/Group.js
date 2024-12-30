import mongoose from "mongoose";

const GroupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    subject: { type: [String], required: true },
    creator: { type: String, required: true },
    members: { type: [String], default: [] },
    requests: { type: [String], default: [] },
    privacy: { type: String, enum: ["Public", "Private"], default: "Public" },
    createdAt: { type: Date, default: Date.now },
    lastUpdated: { type: Date, default: Date.now },
    qrToken: { type: String },
  },
  {
    collection: "Groups",
  }
);

const Group = mongoose.model("Groups", GroupSchema);
export default Group;
