var express = require("express"),
	bodyParser = require("body-parser"),
	mongoose = require("mongoose"),
	seedDB = require("./seed"),
	Comments = require("./models/comments"),
	Users = require("./models/user"),
	Campgrounds = require("./models/campgrounds"),
	session = require("express-session"),
	bcrypt = require("bcryptjs"),
	nodemailer = require("nodemailer"),
	MongoStore = require("connect-mongo")(session),
	jwt = require("jsonwebtoken"),
	app = express();
require("dotenv").config();
// seedDB();
mongoose.connect("mongodb://localhost/yelp_camp", {
	useNewUrlParser: true,
	useUnifiedTopology: true,
});
app.set("view engine", "ejs");
app.listen(process.env.port || 3000, function () {
	console.log("server has started");
});
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
	session({
		name: process.env.SESSION_ID, // name of the session which would be send in the response
		resave: false, // don't know what this is
		saveUninitialized: false, // don't know what this is
		secret: process.env.SESSION_SECRET,
		store: new MongoStore({ mongooseConnection: mongoose.connection }),
		rolling: true,
		// missed session store, see what is its work
		cookie: {
			sameSite: true, // only same site cookie would be allowed
			maxAge: 1000 * 20, // does not allow to use .env variables ???
			// secure: true,
		},
	})
);

// ===========================================
// Middleware functions
// ===========================================

const redirectCampgrounds = (req, res, next) => {
	if (req.session.userId) {
		res.redirect("/campgrounds");
	} else {
		next();
	}
};

const redirectLogin = (req, res, next) => {
	if (req.session.userId) {
		next();
	} else {
		res.redirect("/login");
	}
};

// ===========================================
// Auth Routes
// ===========================================

app.get("/login", redirectCampgrounds, function (req, res) {
	res.render("./login", { success: "", error: "" });
});

app.post("/login", redirectCampgrounds, function (req, res) {
	Users.findOne({ email: req.body.login["email"] })
		.then((foundEntryInDb) => {
			bcrypt
				.compare(req.body.login.password, foundEntryInDb.password)
				.then((resHash) => {
					// succesfully hashed the entered password
					if (resHash) {
						req.session.userId = foundEntryInDb._id;
						res.redirect("/campgrounds");
					} else {
						res.render("./login", { success: "", error: "Incorrect Password" });
					}
				})
				.catch(() => {
					// problem in hashing the entered password and comparing with the already present password in the db
					res.render("./login", { success: "", error: "Please try again" });
				});
		})
		.catch((err) => {
			console.log("the email id is not registered.");
			res.render("./login", { success: "", error: "This email is not registered" });
		});
});

app.get("/register", redirectCampgrounds, function (req, res) {
	res.render("./register", { error: "" });
});

app.post("/register", redirectCampgrounds, function (req, res) {
	if (req.body.register.password === req.body.register.confirmPassword) {
		// const verificationCode = Math.round(Math.random() * 1000000);
		bcrypt
			.genSalt(10)
			.then((salt) => {
				return bcrypt.hash(req.body.register.password, salt);
			})
			.then((hash) => {
				Users.create({
					name: req.body.register.name,
					email: req.body.register.email,
					password: hash,
					// verify: verificationCode,
				})
					.then(() => {
						console.log("new User created");
						res.render("./login", { success: "Account Created. Login Now !!", error: "" });
					})
					.catch((err) => {
						console.log("Email id already exists " + err);
						res.render("./register", { error: "Email already in use !!" });
					});
			})
			.catch((err) => {
				console.log("Error in hashing password " + err);
				res.render("./register", { error: "Password hashing error" });
			});
	} else {
		console.log("Password same. Aborting !!");
		res.render("./register", { error: "Both passwords must match !!" });
	}
});

app.get("/logout", redirectLogin, function (req, res) {
	req.session.userId = "";
	res.render("./login", { success: "", error: "" });
});

app.get("/reset", redirectCampgrounds, function (req, res) {
	res.render("./reset");
});

app.post("/reset", redirectCampgrounds, function (req, res) {
	Users.findOne({ email: req.body.reset.email })
		.then((returnedUserFromDb) => {
			const secret = returnedUserFromDb.password;
			const userId = returnedUserFromDb.email;
			const token = jwt.sign({ userId }, secret, {
				expiresIn: 3600, // 1 hour
			});
			var transporter = nodemailer.createTransport({
				host: "smtp.mailtrap.io",
				port: 2525,
				auth: {
					user: "0c92b23b4dfecd",
					pass: "bf00df94b9ec83",
				},
			});

			var mailOptions = {
				from: "admin@yelpcamp.org",
				to: `${returnedUserFromDb.email}`,
				subject: "Password reset link",
				text: "",
				html: `Hey ${returnedUserFromDb.name} !!<br><br> <button><a href="localhost:3000/reset/new/${returnedUserFromDb.email}/${token}">Click Here to reset your password</a></button><br><br>This is one time use link and is valid only for 1 hour.`,
			};

			transporter
				.sendMail(mailOptions)
				.then((info) => {
					console.log("Email Sent " + info.response);
				})
				.catch((err) => {
					console.log(err);
				});
			res.render("./login", { success: "Reset link has been sent to your email !", error: "" });
		})
		.catch((err) => {
			console.log("Email Id does not exist " + err);
			res.render("./register", { error: "This email is not registered" });
		});
});

app.get("/reset/new/:id/:token", function (req, res) {
	Users.findOneAndUpdate({ email: req.params.id })
		.then((returnedUserFromDb) => {
			jwt.verify(req.params.token, returnedUserFromDb.password, function (err, decoded) {
				if (err) {
					console.log(err);
				} else {
					res.render("./reset-new", { email: req.params.id, error: "" });
				}
			});
		})
		.catch((err) => {
			console.log("This is not possible, how is user not present in the db " + err);
		});
});

app.post("/reset/new/:id", function (req, res) {
	if (req.body.reset.password === req.body.reset.confirmPassword) {
		bcrypt
			.genSalt(10)
			.then((salt) => {
				return bcrypt.hash(req.body.reset.password, salt);
			})
			.then((hash) => {
				return Users.findOneAndUpdate({ email: "siddharthpratapsingh21@gmail.com" }, { password: hash }, { useFindAndModify: false });
			})
			.then((returnedUserFromDb) => {
				res.render("./login", { success: "Password Updated !! Login Now", error: "" });
			})
			.catch((err) => {
				console.log(err);
			});
	} else {
		console.log("Password Same !! Aborting");
		res.render("./reset-new", { email: req.params.id, error: "Both passwords must match" });
	}
});
// ==========================================
// Campground Routes
// ===========================================

app.get("/campgrounds", redirectLogin, function (req, res) {
	Campgrounds.find({}, function (err, campgroundsFromDb) {
		if (err) {
			console.log(err);
		} else {
			res.render("campgrounds/index", { campgroundsArray: campgroundsFromDb });
		}
	});
});

app.post("/campgrounds", redirectLogin, function (req, res) {
	var name = req.body.newCampgroundName;
	var src = req.body.newCampgroundSource;
	var desc = req.body.newCampgroundDescription;
	Campgrounds.create(
		{
			name: name,
			src: src,
			desc: desc,
		},
		function (err, newEntryCampgroud) {
			if (err) {
				console.log(err);
			} else {
				res.redirect("/campgrounds");
			}
		}
	);
});

app.get("/campgrounds/new", redirectLogin, function (req, res) {
	res.render("campgrounds/new");
});

app.get("/campgrounds/:id", function (req, res) {
	Campgrounds.findById(req.params.id)
		.populate("comments")
		.exec()
		.then((matchedCampgroundFromDb) => {
			res.render("campgrounds/show", { matchedCampgroundFromDb: matchedCampgroundFromDb });
		})
		.catch((err) => {
			console.log(err);
		});
});

// ===============================
// Comment Routes
// ===============================

app.get("/campgrounds/:id/comments/new", redirectLogin, function (req, res) {
	res.render("comments/new", { campgroundId: req.params.id });
});

app.post("/campgrounds/:id/comments", redirectLogin, function (req, res) {
	Campgrounds.findById(req.params.id)
		.then((returnedCampgroundFromDb) => {
			Comments.create(req.body.comment)
				.then((returnedCommentFromDb) => {
					returnedCampgroundFromDb.comments.push(returnedCommentFromDb);
					returnedCampgroundFromDb.save();
					res.redirect(`/campgrounds/${returnedCampgroundFromDb._id}`);
				})
				.catch((err) => {
					console.log("Error occured in creating comments" + err);
				});
		})
		.catch((err) => {
			console.log(err);
			res.redirect(`/campgrounds/${returnedCampgroundFromDb._id}`);
		});
});

// ===============================
// 404 Page Not Found
// ===============================

app.get("*", redirectLogin, function (req, res) {
	res.send("404 PAGE NOT FOUND");
});
