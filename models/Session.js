import mongoose from "mongoose";

const SessionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    acceptedBy: { type: [String], default: [] },
    groupId: { type: String, required: true },
  },
  {
    collection: "Sessions",
  }
);
const Session = mongoose.model("Sessions", SessionSchema);
export default Session;
