const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const {
  validateRegisterInput,
  validateLoginInput,
} = require("../util/validators");
const { SECRET_KEY } = require("../config.js");

// get all users
router.get("/", async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

// register
router.post("/register", async (req, res) => {
  let { username, email, password, confirmPassword } = req.body;
  const { valid, errors } = validateRegisterInput(
    username,
    email,
    password,
    confirmPassword
  );
  if (!valid) {
    return res.status(400).json({ errors });
  }
  let finddup = await User.findOne({ username });
  if (finddup) {
    return res.status(400).json({
      errors: {
        username: "Username is taken",
      },
    });
  }
  finddup = await User.findOne({ email });
  if (finddup) {
    return res.status(400).json({
      errors: {
        email: "Email is already registered",
      },
    });
  }
  password = await bcrypt.hash(password, 12);
  const user = new User({
    username: username,
    password: password,
    email: email,
  });
  try {
    const newUser = await user.save();
    const token = generateToken(newUser);
    res.status(201).json({
      ...newUser._doc,
      token,
    });
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
});

// login
router.get("/login", async (req, res) => {
  const { username, password } = req.body;
  const { valid, errors } = validateLoginInput(username, password);
  if (!valid) {
    return res.status(400).json({ errors });
  }
  const user = await User.findOne({ username });
  if (!user) {
    return res.status(400).json({
      errors: {
        general: "User does not exist",
      },
    });
  }
  // match password: string, hash string
  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return res.status(400).json({
      errors: {
        general: "Wrong Password",
      },
    });
  }
  const token = generateToken(user);

  res.user = {
    ...user._doc,
    token,
  };

  res.json(res.user);
});

// update
router.patch("/:id", getUser, async (req, res) => {
  if (req.body.username != null) {
    res.user.username = req.body.name;
  }
  if (req.body.password != null) {
    res.user.password = req.body.password;
  }
  if (req.body.email != null) {
    res.user.email = req.body.email;
  }
  try {
    const updated = await res.user.save();
    res.json(updated);
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
});

// delete
router.delete("/:id", getUser, async (req, res) => {
  try {
    await res.user.remove();
    res.json({ msg: "User Deleted" });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

async function getUser(req, res, next) {
  let user;
  try {
    user = await User.findById(req.params.id);
    if (user == null) {
      return res.status(404).json({ msg: "Cannot find user" });
    }
  } catch (err) {
    return res.status(500).json({ msg: err.message });
  }
  res.user = user;
  next();
}

function generateToken(user) {
  return jwt.sign(
    {
      id: user._id,
      username: user.username,
      email: user.email,
    },
    SECRET_KEY,
    { expiresIn: "1h" }
  );
}
module.exports = router;