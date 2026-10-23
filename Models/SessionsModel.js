const mongoose = require("mongoose");

const SessionsSchema = new mongoose.Schema({
  channelId: {
    type: String,
    required: true,
  },
  messageId: {
    type: String,
    required: true,
  },
});

module.exports = mongoose.model("Sessions", SessionsSchema);
 