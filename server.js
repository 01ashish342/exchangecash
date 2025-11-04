const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config();
const path = require("path");
const UserRequest = require("./models/userRequest");

const Match = require("./models/Match");

// Create express and socket server
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// View engine setup
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

//  MongoDB connection
mongoose
  .connect(process.env.MONGO_URL)
  .then(() => console.log(" MongoDB Connected"))
  .catch((err) => console.log(" MongoDB Error:", err));

//  HOMEPAGE
app.get("/", (req, res) => {
  res.render("index");
});

//  Submit Request (match finder)
app.post("/submit", async (req, res) => {
  const { mode, amount, phone, lat, lng } = req.body;
  const oppositeMode = mode === "cashtoonline" ? "onlinetocash" : "cashtoonline";

  try {
    const newRequest = await UserRequest.create({
      mode,
      amount,
      phone,
      matched: false,
      location: {
        type: "Point",
        coordinates: [parseFloat(lng), parseFloat(lat)],
      },
    });

    console.log(" Request Saved:", newRequest._id);

    const matchedRequest = await UserRequest.findOne({
      mode: oppositeMode,
      matched: false,
      _id: { $ne: newRequest._id },
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: newRequest.location.coordinates,
          },
          $maxDistance: 3000, // 3 km
        },
      },
    });

    if (!matchedRequest) {
      return res.json({ status: "searching" });
    }

    //  Match found → create Match model
    const newMatch = await Match.create({
      user1: newRequest._id,
      user2: matchedRequest._id,
    });
await UserRequest.findByIdAndUpdate(newRequest._id, { matched: true }, { new: true });
await UserRequest.findByIdAndUpdate(matchedRequest._id, { matched: true }, { new: true });


    console.log("✅ Match Created:", newMatch._id);

    //  Send real-time notification to both users
    io.emit("matchFound", { matchId: newMatch._id });

    res.json({ status: "matched", matchId: newMatch._id });

  } catch (error) {
    console.log(" Error:", error);
    res.status(500).json({ error: "Server Error" });
  }
});

//  OTP Page
//  OTP Page + send both user locations
app.get("/verify", async (req, res) => {
 
    const matchId = req.query.matchId;

   
    res.render("verify", {
      matchId,
   
    });

  
});



//  Verify OTP
app.post("/verify-otp", (req, res) => {
  const { otp, matchId } = req.body;

  if (!matchId) return res.status(400).json({ success: false, message: "Match ID missing" });

  if (otp === "123456") {
    return res.json({ success: true, matchId });
  }

  res.json({ success: false });
});

//  Chat Page
app.get("/chat", async (req, res) => {
  try {
    const matchId = req.query.matchId;

    const match = await Match.findById(matchId)
      .populate("user1")
      .populate("user2");

    if (!match) return res.send("Match not found");

    res.render("chat", {
      matchId: req.query.matchId,
      user1: match.user1,
      user2: match.user2,
      user1Lat: match.user1.location.coordinates[1],
      user1Lng: match.user1.location.coordinates[0],
      user2Lat: match.user2.location.coordinates[1],
      user2Lng: match.user2.location.coordinates[0]
    });

  } catch (error) {
    console.log("⚠️ Error loading verify page:", error);
    res.status(500).send("Server Error");
  }
});


//  Socket chat system
io.on("connection", (socket) => {
  socket.on("joinRoom", (matchId) => socket.join(matchId));

  socket.on("sendMessage", (data) => {
    socket.to(data.matchId).emit("receiveMessage", data);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(` Server running on port ${PORT}`));
