const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config();
const path = require("path");


const userRequest = require("./models/userRequest");
const Match = require("./models/Match");

const app = express();

const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");     
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});


app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// View engine setup
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ✅ MongoDB connection
mongoose
  .connect(process.env.MONGO_URL)
  .then(() => console.log(" MongoDB Connected"))
  .catch((err) => console.log(" MongoDB Error:", err));

// ✅ Homepage
app.get("/", (req, res) => {
  res.render("index");
});


app.post("/submit", async (req, res) => {
  const { mode, amount, phone, lat, lng } = req.body;

  const oppositeMode = mode === "cashtoonline" ? "onlinetocash" : "cashtoonline";

  try {
    // ✅ Save request into DB
    const newRequest = await userRequest.create({
      mode,
      amount,
      phone,
      location: {
        type: "Point",                  
        coordinates: [parseFloat(lng), parseFloat(lat)],
      },
    });

    console.log(" Request Saved:", newRequest._id);

    // ✅ Search nearby match (within 3km)
    const matchedRequest = await userRequest.findOne({
      mode: oppositeMode,
      matched: false,
      _id: { $ne: newRequest._id }, // avoid matching with itself
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: newRequest.location.coordinates,
          },
          $maxDistance: 3000, 
        },
      },
    });

    if (!matchedRequest) {
      return res.json({ status: "searching" });
    }

    // ✅ Match found → create Match record
    const newMatch = await Match.create({
      user1: newRequest._id,
      user2: matchedRequest._id,
    });

    // ✅ Update matched status for both users
    await userRequest.findByIdAndUpdate(newRequest._id, { matched: true });
    await userRequest.findByIdAndUpdate(matchedRequest._id, { matched: true });

    console.log(" Match Created:", newMatch._id);

    res.json({ status: "matched", matchId: newMatch._id });
  } catch (error) {
    console.log(" Error:", error);
    res.status(500).json({ error: "Server Error" });
  }
});


app.get("/verify", (req, res) => {
  res.render("verify");
});

app.post("/verify-otp", (req, res) => {
  const { otp } = req.body;

  if (otp === "123456") {  // for testing, replace later with real generated OTP
    return res.json({ success: true, matchId: "example123" });
  }

  res.json({ success: false });
});

app.get("/chat", (req, res) => {
  res.render("chat", { matchId: req.query.matchId });
});



io.on("connection", (socket) => {
  socket.on("joinRoom", (matchId) => {
    socket.join(matchId);
  });

  socket.on("sendMessage", (data) => {
    socket.to(data.matchId).emit("receiveMessage", data);
  });
});


const Port = process.env.PORT || 3000;

server.listen(Port, () => {
  console.log(`🚀 Server is running on port ${Port}`);
});

