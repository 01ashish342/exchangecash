const mongoose = require("mongoose");

const matchSchema = new mongoose.Schema({
  user1: { type: mongoose.Schema.Types.ObjectId, ref: "UserRequest" },
  user2: { type: mongoose.Schema.Types.ObjectId, ref: "UserRequest" },
  otpUser1: Number,
  otpUser2: Number,
  verifiedUser1: { type: Boolean, default: false },
  verifiedUser2: { type: Boolean, default: false },
});

module.exports = mongoose.model("Match", matchSchema);
