import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";
import cors from "cors";
import jwt from "jsonwebtoken";
import Group from "./models/Group.js";

const app = express();
dotenv.config();

const PORT = process.env.PORT;
const MONGOURL = process.env.MONGODB_URL;
const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY;

mongoose
  .connect(MONGOURL)
  .then(() => {
    console.log("Database is connected successfully.");
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.log(error);
  });

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send({ status: "Started" });
});

app.post("/signUp", async (req, res) => {
  const { username, email, password, firstName, lastName, city } = req.body;

  const oldUser = await User.findOne(
    { email: email } || { username: username }
  );

  if (oldUser) {
    return res.send({ data: "User already exists!" });
  }

  try {
    const newUser = await User.create({
      username: username,
      email: email,
      password: password,
      firstName: firstName,
      lastName: lastName,
      city: city,
    });

    res.status(201).json({
      status: 201,
      success: true,
      message: "User created successfully!",
    });
  } catch (error) {
    res.send({ status: "error", data: error });
  }
});

app.post("/signIn", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email: email });

    if (!user) {
      console.log("user!!!");
      return res.send({ status: "error", data: "User not found" });
    }

    if (user.password !== password) {
      console.log("parola");
      return res.send({
        status: "error",
        data: "Incorrect password. Try again.",
      });
    } else {
      const token = jwt.sign(
        { userId: user._id, username: user.username },
        JWT_SECRET_KEY,
        { expiresIn: "24h" }
      );
      res.json({
        success: true,
        message: "User logged in successfully!",
        token: token,
        username: user.username,
      });
    }
  } catch (error) {
    res.send({ status: "error", data: error.message });
  }
});

app.post("/createGroup", async (req, res) => {
  const { name, description, subject, privacy, creator } = req.body;

  const anotherGroup = await Group.findOne({ name: name });

  if (anotherGroup) {
    return res.send({ data: "Group name taken!" });
  }

  try {
    await Group.create({
      name: name,
      description: description,
      subject: subject,
      privacy: privacy,
      creator: creator,
      members: [],
    });

    res.json({
      status: 201,
      success: true,
      data: "Group created successfully!",
    });
  } catch (error) {
    res.send({ status: "error", data: error });
  }
});

app.get("/fetchOwnedGroups/:username", async (req, res) => {
  try {
    const loggedUser = req.params.username;
    const groups = await Group.find({ creator: loggedUser });

    res.json({
      success: true,
      message: `Groups owned by ${loggedUser} fetch successfully!`,
      groups: groups,
    });
  } catch (error) {
    res.json("Groups have not been fetched correctly!");
  }
});

app.get("/fetchMemeberGroups/:username", async (req, res) => {
  try {
    const loggedUser = req.params.username;
    const groups = await Group.find({ member: loggedUser });

    res.json({
      success: true,
      message: `Groups ${loggedUser} is a memember of fetched successfully!`,
      groups: groups,
    });
  } catch (error) {
    res.json("Groups have not been fetched correctly!");
  }
});
