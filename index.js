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
import crypto from "crypto";
import QRCode from "qrcode";
import { Buffer } from "buffer";
import axios from "axios";
import haversine from "haversine";
import Subject from "./models/Subjects.js";

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

// SIGN-UP

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

// SIGN-IN

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

// USER

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

app.get("/getUsernameById/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const user = await User.findById(userId);

    if (!user) {
      throw new Error("User not found");
    }

    res.json({
      success: true,
      username: user.username,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching username",
      error: error.message,
    });
  }
});

app.get("/getUser/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const user = await User.findById(userId);

    if (!user) {
      throw new Error("User not found");
    }

    res.json({
      success: true,
      user: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching username",
      error: error.message,
    });
  }
});

// GROUP

app.post("/createGroup", async (req, res) => {
  const { name, description, subject, privacy, creator, city } = req.body;

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
      requests: [],
      city: city,
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

app.get("/fetchMemberGroups/:username", async (req, res) => {
  try {
    const loggedUser = req.params.username;
    const groups = await Group.find({ members: { $in: [loggedUser] } });
    res.json({
      success: true,
      message: `Groups ${loggedUser} is a memember of fetched successfully!`,
      groups: groups,
    });
  } catch (error) {
    res.json("Groups have not been fetched correctly!");
  }
});

app.get("/fetchGroup/:groupId", async (req, res) => {
  try {
    const groupId = req.params.groupId;
    const group = await Group.findById(groupId);
    res.json({
      success: true,
      message: `Group is fetched successfully!`,
      group: group,
    });
  } catch (error) {
    res.json("Group has not been fetched correctly!");
  }
});

app.get("/searchGroups", async (req, res) => {
  const { query, userId } = req.query;
  try {
    const user = await User.findById(userId);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const groups = await Group.find({
      privacy: "Public",
      $or: [
        { name: { $regex: query, $options: "i" } },
        { subject: { $regex: query, $options: "i" } },
        { city: { $regex: query, $options: "i" } },
      ],
    });

    const filteredGroups = groups.filter((group) => {
      return !(
        group.creator.toString() === user.username ||
        group.members.includes(user.username)
      );
    });

    res.json({
      success: true,
      groups: filteredGroups,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error searching groups" });
  }
});

app.delete("/deleteGroup/:groupId", async (req, res) => {
  const { groupId } = req.params;
  try {
    await Group.findByIdAndDelete(groupId);
    res.json({ success: true, message: "Group deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to delete group" });
  }
});

app.post("/editGroup/:groupId", async (req, res) => {
  const { groupId } = req.params;
  const { name, description, privacy, city, subject } = req.body;
  try {
    const updatedGroup = await Group.findByIdAndUpdate(
      groupId,
      { name, description, privacy, city, subject },
      { new: true }
    );
    res.json({ success: true, data: updatedGroup });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update group" });
  }
});

app.post("/leaveGroup", async (req, res) => {
  const { groupId, username } = req.body;
  try {
    const group = await Group.findById(groupId);
    group.members = group.members.filter((member) => member !== username);
    await group.save();
    res.json({ success: true, message: "You have left the group" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to leave group" });
  }
});

app.post("/sendRequestToJoin", async (req, res) => {
  const { groupId, username } = req.body;

  try {
    const group = await Group.findByIdAndUpdate(
      groupId,
      { $push: { requests: username } },
      { new: true }
    );

    if (!group) {
      return res
        .status(404)
        .json({ success: false, message: "Group not found" });
    }

    res.json({
      success: true,
      group: group,
    });
  } catch (error) {
    console.error("Error updating group:", error);
    res.status(500).json({ success: false, message: "Error updating group" });
  }
});

app.post("/acceptRequest", async (req, res) => {
  const { groupId, username } = req.body;
  try {
    const group = await Group.findByIdAndUpdate(
      groupId,
      { $push: { members: username }, $pull: { requests: username } },
      { new: true }
    );
    if (!group) {
      return res
        .status(404)
        .json({ success: false, message: "Group not found" });
    }

    res.json({
      success: true,
      group: group,
    });
  } catch (error) {
    console.error("Error updating group:", error);
    res.status(500).json({ success: false, message: "Error updating group" });
  }
});

app.post("/declineRequest", async (req, res) => {
  const { groupId, username } = req.body;

  try {
    const group = await Group.findByIdAndUpdate(
      groupId,
      { $pull: { requests: username } },
      { new: true }
    );

    if (!group) {
      return res
        .status(404)
        .json({ success: false, message: "Group not found" });
    }

    res.json({
      success: true,
      group: group,
    });
  } catch (error) {
    console.error("Error updating group:", error);
    res.status(500).json({ success: false, message: "Error updating group" });
  }
});

app.post("/joinGroup", async (req, res) => {
  const { token, username } = req.body;
  console.log(token);
  try {
    const group = await Group.findOne({ qrToken: token });
    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }

    if (group.members.includes(username)) {
      return res.json({
        success: false,
        message: "You are already a member of this group.",
      });
    }

    await Group.findByIdAndUpdate(
      group._id,
      { $push: { members: username } },
      { new: true }
    );

    res.json({ success: true, message: "You have joined the group." });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error joining group." });
  }
});

app.get("/getSubjects", async (req, res) => {
  try {
    const subjects = await Subject.find().select("key value").lean();

    res.json({
      success: true,
      subjects: subjects,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching subjects",
      error: error.message,
    });
  }
});

//SESSIONS

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
      return res.json({
        success: false,
        message: "The session overlaps with an existing session.",
      });
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

app.post("/editSession/:sessionId", async (req, res) => {
  const { sessionId } = req.params;
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

    const sessions = await Session.find({ groupId, _id: { $ne: sessionId } });

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
      return res.status(400).json({
        success: false,
        message: "The session overlaps with an existing session.",
      });
    }

    const updatedSession = await Session.findByIdAndUpdate(
      sessionId,
      {
        name: name,
        startDate: startDate,
        endDate: endDate,
        startTime: startTime,
        endTime: endTime,
        groupId: groupId,
        acceptedBy: acceptedBy,
      },
      { new: true }
    );

    if (!updatedSession) {
      return res.status(404).json({
        success: false,
        message: "Session not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Session updated successfully!",
      session: updatedSession,
    });
  } catch (error) {
    console.error("Error updating session:", error);
    res.status(500).json({
      success: false,
      message: "Error updating session.",
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

app.get("/fetchSessions/:groupId", async (req, res) => {
  const groupId = req.params.groupId;

  try {
    const sessions = await Session.find({
      groupId: groupId,
    });

    res.json({
      success: true,
      sessions: sessions || [],
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching group sessions",
      error: error.message,
    });
  }
});

app.get("/fetchSession/:sessionId", async (req, res) => {
  const sessionId = req.params.sessionId;

  try {
    const session = await Session.findById(sessionId);

    res.json({
      success: true,
      session: session,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching group sessions",
      error: error.message,
    });
  }
});

app.delete("/deleteSession/:sessionId", async (req, res) => {
  const { sessionId } = req.params;
  try {
    await Session.findByIdAndDelete(sessionId);
    res.json({ success: true, message: "Session deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to delete session" });
  }
});

// MESSAGES AND FILES

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

app.get("/downloadById/:fileId", async (req, res) => {
  const fileId = req.params.fileId;
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

// QR CODE

app.post("/generateGroupQRCode", async (req, res) => {
  const { groupId, username } = req.body;

  try {
    const group = await Group.findById(groupId);
    if (!group || group.creator !== username) {
      return res
        .status(403)
        .json({ message: "You are not the admin of this group." });
    }

    const token = crypto.randomBytes(8).toString("hex");

    await Group.findByIdAndUpdate(groupId, { qrToken: token });

    const qrCodeData = `http://172.20.10.5:8000/joinGroup?token=${token}`;
    const qrCode = await QRCode.toDataURL(qrCodeData);

    res.json({ success: true, qrCode });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Error generating QR code." });
  }
});

// PROFILE

app.post("/uploadProfilePicture", upload.single("file"), async (req, res) => {
  const { userId } = req.body;
  const file = req.file;

  if (!file) {
    return res
      .status(400)
      .json({ success: false, message: "File is required" });
  }

  try {
    const oldProfilePicture = await User.findOne({ _id: userId }).select(
      "profilePicture"
    );

    if (oldProfilePicture && oldProfilePicture.profilePicture) {
      const oldFileId = oldProfilePicture.profilePicture.split("/images/")[1];
      await gfs.delete(new mongoose.Types.ObjectId(oldFileId));
      console.log(`Deleted old profile picture: ${oldFileId}`);
    }

    const uploadStream = gfs.openUploadStream(file.originalname, {
      metadata: { userId },
      contentType: file.mimetype,
    });

    uploadStream.end(file.buffer);

    uploadStream.on("finish", async () => {
      const profilePictureUri = `/images/${uploadStream.id}`;

      const user = await User.findByIdAndUpdate(
        userId,
        { profilePicture: profilePictureUri },
        { new: true }
      );

      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      res.status(201).json({
        success: true,
        message: "Profile picture uploaded successfully",
        profilePictureUri,
      });
    });
  } catch (error) {
    console.error("Error uploading profile picture:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.get("/getImageByUserId/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const files = await gfs.find({ "metadata.userId": userId }).toArray();

    if (!files || files.length === 0) {
      return res.status(404).json({ error: "Image not found" });
    }
    console.log(files);
    const file = files[0];

    if (file.contentType.includes("image")) {
      const readStream = gfs.openDownloadStream(file._id);
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
