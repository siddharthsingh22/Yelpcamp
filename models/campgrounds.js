var mongoose = require("mongoose"),
	Comments = require("./comments");

var campgroundSchema = new mongoose.Schema({
	name: String,
	src: String,
	desc: String,
	comments: [
		{
			type: mongoose.Schema.Types.ObjectId,
			ref: Comments,
		},
	],
});
var Campgrounds = mongoose.model("Campground", campgroundSchema);

module.exports = Campgrounds;
