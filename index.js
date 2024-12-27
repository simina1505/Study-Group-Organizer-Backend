import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";
import cors from "cors";
import jwt from "jsonwebtoken";
import Group from "./models/Group.js";
import Session from "./models/Session.js";
import multer from "multer";
import File from "./models/Files.js";
import Message from "./models/Message.js";

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

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
      return res.send({ status: "error", data: "User not found" });
    }

    if (user.password !== password) {
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
        userId: user._id,
      });
    }
  } catch (error) {
    res.send({ status: "error", data: error.message });
  }
});

app.post("/checkUserExistence", async (req, res) => {
  const { field, value } = req.body;

  if (!["username", "email"].includes(field)) {
    return res
      .status(400)
      .send({ available: false, message: "Invalid field." });
  }

  const query = {};
  query[field] = value;

  try {
    const existingUser = await User.findOne(query);
    res.send({ available: !existingUser });
  } catch (error) {
    res
      .status(500)
      .send({ available: false, message: "Error checking user availability." });
  }
});

app.post("/createGroup", async (req, res) => {
  const { name, description, subject, privacy, creator } = req.body;

  const anotherGroup = await Group.findOne({ name: name });

  if (anotherGroup) {
    return res.send({ data: "Group name taken!", success: false });
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

app.post("/checkGroupExistence", async (req, res) => {
  const { field, value } = req.body;

  if (!["name"].includes(field)) {
    return res
      .status(400)
      .send({ available: false, message: "Invalid field." });
  }

  const query = {};
  query[field] = value;

  try {
    const existingGroup = await Group.findOne(query);
    res.send({ available: !existingGroup });
  } catch (error) {
    res.status(500).send({
      available: false,
      message: "Error checking group availability.",
    });
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

app.post("/createSession", async (req, res) => {
  const { name, startDate, endDate, startTime, endTime, groupId, acceptedBy } =
    req.body;

  try {
    const getTimestamp = (date, time) => {
      const dateStr =
        date instanceof Date ? date.toISOString().split("T")[0] : date;
      const [hour, minute] = time.split(":");
      const [year, month, day] = dateStr.split("-");

      const dateTime = new Date(year, month - 1, day, hour, minute);
      return dateTime.getTime();
    };

    const newStartTimestamp = getTimestamp(startDate, startTime);
    const newEndTimestamp = getTimestamp(endDate, endTime);

    if (isNaN(newStartTimestamp) || isNaN(newEndTimestamp)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid start or end date/time." });
    }

    const sessions = await Session.find({ groupId });

    const isValid = sessions.every((session) => {
      const sessionStartTimestamp = getTimestamp(
        session.startDate,
        session.startTime
      );
      const sessionEndTimestamp = getTimestamp(
        session.endDate,
        session.endTime
      );

      return (
        newEndTimestamp <= sessionStartTimestamp ||
        newStartTimestamp >= sessionEndTimestamp
      );
    });

    if (!isValid) {
      res.status(400).json({
        success: false,
        message: "The session overlaps with an existing session.",
      });
      return;
    }

    const newSession = await Session.create({
      name: name,
      startDate: startDate,
      endDate: endDate,
      startTime: startTime,
      endTime: endTime,
      groupId: groupId,
      acceptedBy: acceptedBy,
    });

    res.status(201).json({
      success: true,
      message: "Session created successfully!",
      session: newSession,
    });
  } catch (error) {
    console.error("Error creating session:", error);
    res.status(500).json({
      success: false,
      message: "Error creating session.",
      error: error.message,
    });
  }
});

app.get("/fetchUserSessions/:username", async (req, res) => {
  const username = req.params.username;

  try {
    const sessions = await Session.find({
      acceptedBy: username,
    });

    res.json({
      success: true,
      sessions: sessions || [],
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching user sessions",
      error: error.message,
    });
  }
});

app.post("/uploadFile", upload.single("file"), async (req, res) => {
  const { senderId, groupId, content } = req.body;
  const file = req.file;
  try {
    const newFile = await File.create({
      fileName: file.originalname,
      fileData: file.buffer,
      senderId,
      groupId,
    });

    const newMessage = await Message.create({
      senderId,
      groupId,
      content,
      file: newFile._id, // Save the file ID in the message
      timestamp: new Date(),
    });

    res.json({
      success: true,
      file: newFile,
      message: newMessage,
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    res.status(500).json({ success: false, message: "Error uploading file." });
  }
});

// Send a message endpoint
app.post("/sendMessage", async (req, res) => {
  const { senderId, groupId, content } = req.body;
  try {
    const newMessage = await Message.create({
      senderId,
      groupId,
      content,
    });
    res.status(200).json({ success: true, message: "message sent" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Error sending message", error });
  }
});

app.get("/fetchMessagesandFiles/:groupId", async (req, res) => {
  try {
    const groupId = req.params.groupId;

    // Fetch messages with populated senderId to get the username of the sender
    const messages = await Message.find({ groupId });

    // Fetch files related to the group (if necessary)
    const files = await File.find({ groupId });

    // Format the response to send only necessary data
    const formattedMessages = messages.map((message) => {
      return {
        _id: message._id,
        content: message.content,
        senderId: message.senderId.username, // Ensure we're sending only the username of the sender
        fileName: message.file ? message.file.fileName : null, // Attach file info if present
      };
    });

    const formattedFiles = files.map((file) => ({
      _id: file._id,
      fileName: file.fileName,
      senderId: file.senderId,
    }));

    res.json({
      success: true,
      messages: formattedMessages,
      files: formattedFiles,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching messages and files",
      error,
    });
  }
});
