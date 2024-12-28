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
import { GridFSBucket } from "mongodb";

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
      metadata: { senderId, groupId }, // Store metadata if needed
      contentType: file.mimetype,
    });

    uploadStream.end(file.buffer); // Write file buffer to GridFS

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

// Retrieve all messages (text and file messages) for a group
app.get("/fetchMessagesandFiles/:groupId", async (req, res) => {
  const { groupId } = req.params;

  try {
    const textMessages = await Message.find({ groupId }).sort({ timestamp: 1 });
    const fileMessages = await File.find({ groupId }).sort({ timestamp: 1 });

    const fileMessagesWithUrl = await Promise.all(
      fileMessages.map(async (file) => {
        const fileUrl = `http://172.20.10.5:8000/files/download/${file.fileData}`; // Assuming this URL structure for file download
        return {
          _id: file._id,
          text: `File: ${file.fileName}`,
          timestamp: file.timestamp,
          user: { _id: file.senderId },
          file: { url: fileUrl, name: file.fileName },
        };
      })
    );

    // Combine text and file messages
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
// app.get("/downloadById/:fileId", (req, res) => {
//   const fileId = req.params.fileId;
//   console.log("ajunge aici?");

//   // Find the file in the uploads.files collection using its ID
//   gfs.find({ _id: mongoose.Types.ObjectId(fileId) }).toArray((err, files) => {
//     if (err) {
//       return res.status(500).send("Error finding file metadata");
//     }

//     if (files.length === 0) {
//       return res.status(404).send("File not found");
//     }

//     const file = files[0]; // Assuming we take the first matching file

//     // Set headers for downloading the file
//     res.setHeader("Content-Type", file.contentType);
//     res.setHeader(
//       "Content-Disposition",
//       `attachment; filename="${file.filename}"`
//     );

//     // Open the download stream from GridFS and pipe it to the response
//     const downloadStream = gfs.openDownloadStream(file._id);
//     downloadStream.pipe(res);

//     downloadStream.on("error", (err) => {
//       console.error("Error downloading file:", err);
//       res.status(500).send("Error downloading file");
//     });
//   });
// });

// app.get("/getFileMetadata/:fileName", (req, res) => {
//   const fileName = req.params.fileName;
//   console.log("Fetching file metadata for:", fileName);
//   db.uploads.files.find().pretty();
//   db.uploads.chunks.find().pretty();

//   if (!gfs) {
//     console.log("?/");
//     return res.status(500).send("GridFS not initialized.");
//   }
//   console.log("wtf");

//   gfs.find({ filename: fileName }).toArray((err, files) => {
//     if (err) {
//       console.log("nu");
//       return res.status(500).send("Error finding file metadata");
//     }

//     if (files.length === 0) {
//       return res.status(404).send("File not found");
//     }

//     const file = files[0]; // Take the first matching file
//     console.log(file);
//     if (file) {
//       res.json({
//         fileName: file.filename,
//         fileId: file._id, // Return the file's ID
//         contentType: file.contentType,
//         success: true,
//       });
//     } else {
//       res.json({
//         success: false,
//       });
//     }
//   });
// });

app.get("/getImageByName/:fileName", (req, res) => {
  const fileName = req.params.fileName;

  gfs.find({ filename: fileName }).toArray((err, files) => {
    if (err) {
      return res.status(500).json({ error: "Error retrieving file" });
    }

    if (!files || files.length === 0) {
      return res.status(404).json({ error: "File not found" });
    }

    const file = files[0];

    if (file.contentType.includes("image")) {
      const readStream = gfs.openDownloadStreamByName(fileName); // Use the filename to open a stream
      res.set("Content-Type", file.contentType); // Set the content type for the response
      readStream.pipe(res); // Pipe the image file to the response
    } else {
      res.status(400).json({ error: "Not an image file" });
    }
  });
});
