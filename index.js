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
import { GridFSBucket, ObjectId } from "mongodb";

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

let gfs;
mongoose.connection.on("connected", () => {
  const db = mongoose.connection.db;
  gfs = new GridFSBucket(db, { bucketName: "uploads" });
  console.log("GridFS initialized.");
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

app.get("/searchGroups", async (req, res) => {
  const { query } = req.query;
  console.log("Search query received:", query);

  try {
    const groups = await Group.find({
      name: { $regex: query, $options: "i" },
    });

    res.json({
      success: true,
      groups: groups,
    });
    console.log("Groups found:", groups);
  } catch (error) {
    res.status(500).json({ success: false, message: "Error searching groups" });
  }
});

// app.get("/searchGroups", async (req, res) => {
//   const { groupId, username } = req.params;

//   try {
//     const groups = await Group.find({
//       name: { $regex: query, $options: "i" },
//     });

//     res.json({
//       success: true,
//       groups: groups,
//     });
//     console.log("Groups found:", groups);
//   } catch (error) {
//     res.status(500).json({ success: false, message: "Error searching groups" });
//   }
// });

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
app.post("/sendMessage", async (req, res) => {
  const { senderId, groupId, content } = req.body;

  try {
    const message = await Message.create({
      senderId,
      groupId,
      content,
    });

    res.status(201).json({ success: true, message });
  } catch (error) {
    console.error("Error saving message:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Save a file message
app.post("/sendFile", upload.single("file"), async (req, res) => {
  const { senderId, groupId } = req.body;
  const file = req.file;

  try {
    if (!file) {
      return res
        .status(400)
        .json({ success: false, message: "File is required" });
    }

    const uploadStream = gfs.openUploadStream(file.originalname, {
      metadata: { senderId, groupId },
      contentType: file.mimetype,
    });

    uploadStream.end(file.buffer);

    uploadStream.on("finish", async () => {
      const fileMessage = await File.create({
        senderId,
        groupId,
        fileName: file.originalname,
        fileData: uploadStream.id,
      });

      res.status(201).json({ success: true, fileMessage });
    });
  } catch (error) {
    console.error("Error saving file:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.get("/fetchMessagesandFiles/:groupId", async (req, res) => {
  const { groupId } = req.params;

  try {
    const textMessages = await Message.find({ groupId }).sort({ timestamp: 1 });
    const fileMessages = await File.find({ groupId }).sort({ timestamp: 1 });

    const fileMessagesWithUrl = await Promise.all(
      fileMessages.map(async (file) => {
        const fileUrl = `http://172.20.10.5:8000/files/download/${file.fileData}`;
        return {
          _id: file._id,
          text: `File: ${file.fileName}`,
          timestamp: file.timestamp,
          user: { _id: file.senderId },
          file: { url: fileUrl, name: file.fileName },
        };
      })
    );

    const allMessages = [...textMessages, ...fileMessagesWithUrl].sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );
    res.json({
      success: true,
      messages: allMessages,
    });
  } catch (error) {
    console.error("Error retrieving messages:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Retrieve a file by ID
app.get("/downloadById/:fileId", async (req, res) => {
  const fileId = req.params.fileId;
  console.log("Fetching file for download with ID:", fileId);
  if (!gfs) {
    console.error("GridFS not initialized.");
    return res
      .status(500)
      .json({ success: false, message: "GridFS not initialized." });
  }

  try {
    if (!ObjectId.isValid(fileId)) {
      console.error("Invalid file ID:", fileId);
      return res
        .status(400)
        .json({ success: false, message: "Invalid file ID." });
    }

    const objectId = new ObjectId(fileId);

    const file = await gfs.find({ _id: objectId }).toArray();

    if (!file || file.length === 0) {
      console.warn("File not found:", fileId);
      return res
        .status(404)
        .json({ success: false, message: "File not found." });
    }
    const encodedFilename = encodeURIComponent(file[0].filename);

    const downloadStream = gfs.openDownloadStream(objectId);

    res.set({
      "Content-Type": file[0].contentType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodedFilename}`,
    });

    downloadStream.on("error", (err) => {
      console.error("Error during file download:", err);
      res
        .status(500)
        .json({ success: false, message: "Error during file download." });
    });

    downloadStream.pipe(res);
    console.log("e ok");
  } catch (err) {
    console.error("Error finding file:", err);
    res.status(500).json({ success: false, message: "Error fetching file." });
  }
});

app.get("/getImageByName/:fileName", async (req, res) => {
  const { fileName } = req.params;

  try {
    const files = await gfs.find({ filename: fileName }).toArray();

    if (!files || files.length === 0) {
      return res.status(404).json({ error: "Image not found" });
    }

    const file = files[0];

    if (file.contentType.includes("image")) {
      const readStream = gfs.openDownloadStreamByName(fileName);
      res.setHeader("Content-Type", file.contentType);
      readStream.pipe(res);
    } else {
      res.status(400).json({ error: "Not an image file" });
    }
  } catch (error) {
    console.error("Error retrieving image:", error);
    res.status(500).json({ error: "Error retrieving image" });
  }
});

app.get("/getFileMetadata/:fileName", async (req, res) => {
  const fileName = req.params.fileName;
  console.log("Fetching file metadata for:", fileName);

  if (!gfs) {
    console.error("GridFS not initialized.");
    return res
      .status(500)
      .json({ success: false, message: "GridFS not initialized." });
  }

  try {
    const files = await gfs.find({ filename: fileName }).toArray();

    if (!files || files.length === 0) {
      console.warn("File not found:", fileName);
      return res
        .status(404)
        .json({ success: false, message: "File not found." });
    }

    const file = files[0];
    console.log("File metadata fetched successfully:", file);

    res.status(200).json({
      success: true,
      fileName: file.filename,
      fileId: file._id,
      contentType: file.contentType,
      uploadDate: file.uploadDate,
      length: file.length,
    });
  } catch (error) {
    console.error("Error fetching file metadata:", error);
    res
      .status(500)
      .json({ success: false, message: "Error fetching file metadata." });
  }
});
