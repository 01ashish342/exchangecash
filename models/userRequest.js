const mongoose = require("mongoose");

const userRequestSchema = new mongoose.Schema({
  mode: {
    type: String,
    enum: ["cashtoonline", "onlinetocash"],
    required: true,
  },

  amount: {
    type: Number,
    required: true,
  },

  phone: {
    type: String,   // ✅ use string to store phone number safely
    required: true,
  },

  location: {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point",
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true, // ✅ makes sure location always exists
    },
  },

  matched: {
    type: Boolean,
    default: false,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// ✅ Required for geo indexing in MongoDB
userRequestSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("UserRequest", userRequestSchema);
