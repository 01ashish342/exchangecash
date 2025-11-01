const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config();
const path = require("path");

const userRequest = require("./models/userRequest");
const Match = require("./models/Match");

const app = express();

// ✅ SOCKET SERVER
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ✅ EJS Setup
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ✅ MongoDB Connection
mongoose
  .connect(process.env.MONGO_URL)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.log("❌ MongoDB Error:", err));

// ✅ HomePage
app.get("/", (req, res) => {
  res.render("index");
});

// ✅ MATCHING LOGIC (UPDATED)
app.post("/submit", async (req, res) => {
  try {
    const { mode, amount, phone, lat, lng } = req.body;

    // 1️⃣ Save request to DB
    const request = await userRequest.create({
      mode,
      amount,
      phone,
      matched: false,
      location: {
        type: "Point",
        coordinates: [parseFloat(lng), parseFloat(lat)],
      },
    });

    console.log("📌 Request Saved:", request._id);

    // 2️⃣ Find nearest opposite request
    const oppositeMode = mode === "cashtoonline" ? "onlinetocash" : "cashtoonline";

    const otherUser = await userRequest.findOne({
      mode: oppositeMode,
      matched: false,
      _id: { $ne: request._id },
      location: {
        $near: {
          $geometry: { type: "Point", coordinates: request.location.coordinates },
          $maxDistance: 5000, // ✅ 5 km radius
        },
      },
    });

    if (!otherUser) {
      return res.json({ status: "waiting" }); // frontend keeps checking
    }

    // 3️⃣ Create match with OTP
    const otpValue = Math.floor(100000 + Math.random() * 900000);

    const newMatch = await Match.create({
      user1: request._id,
      user2: otherUser._id,
      otp: otpValue,
    });

    // 4️⃣ Mark both users as matched
    await userRequest.findByIdAndUpdate(request._id, { matched: true });
    await userRequest.findByIdAndUpdate(otherUser._id, { matched: true });

    console.log("✅ Match Created:", newMatch._id);

    // ✅ Notify both users via socket
    io.emit("matchFound", { matchId: newMatch._id });

    res.json({ status: "matched", matchId: newMatch._id });
  } catch (error) {
    console.log("❌ Match Error:", error);
    res.status(500).json({ status: "error" });
  }
});

// OTP VERIFY PAGE
app.get("/verify", (req, res) => {
  const matchId = req.query.matchId;
  res.render("verify", { matchId });
});

// ✅ OTP Verification POST
app.post("/verify-otp", async (req, res) => {
  try {
    const { otp, matchId } = req.body;

    const match = await Match.findById(matchId);

    if (!match) return res.json({ success: false });

    if (otp == match.otp) {
      return res.json({ success: true, matchId });
    }

    res.json({ success: false });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// ✅ Chat Page
app.get("/chat", (req, res) => {
  const matchId = req.query.matchId;
  res.render("chat", { matchId });
});

// ✅ SOCKET CHAT
io.on("connection", (socket) => {
  console.log("🟢 User Connected");

  socket.on("joinRoom", (matchId) => {
    socket.join(matchId);
  });

  socket.on("sendMessage", (data) => {
    socket.to(data.matchId).emit("receiveMessage", data);
  });
});

// ✅ Run Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
