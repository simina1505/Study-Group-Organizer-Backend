import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    username: String,
    email: { type: String, unique: true },
    password: String,
    firstName: String,
    lastName: String,
    city: String,
  },
  {
    collection: "Users",
  }
);
const User = mongoose.model("Users", UserSchema);
export default User;
