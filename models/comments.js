const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema({
	author: String,
	content: String,
});

const Comments = mongoose.model("Comment", commentSchema);

module.exports = Comments;
