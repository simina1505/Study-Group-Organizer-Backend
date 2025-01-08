import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    city: String,
    profilePicture: { type: String },
  },
  {
    collection: "Users",
  }
);
const User = mongoose.model("Users", UserSchema);
export default User;
