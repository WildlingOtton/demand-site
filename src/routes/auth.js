const express = require('express');
const router = express.Router();
const { User } = require('../models');

// GET /auth/register
router.get('/register', (req, res) => {
  if (req.session.userId) return res.redirect('/demands');
  res.render('auth/register', {
    title: 'Register',
    roles: User.ROLES,
    error: req.flash('error'),
    success: req.flash('success'),
    formData: {},
  });
});

// POST /auth/register
router.post('/register', async (req, res) => {
  const { username, email, password, confirmPassword, role } = req.body;

  if (!username || !email || !password || !confirmPassword) {
    req.flash('error', 'All fields are required.');
    return res.redirect('/auth/register');
  }

  if (password !== confirmPassword) {
    req.flash('error', 'Passwords do not match.');
    return res.redirect('/auth/register');
  }

  if (password.length < 8) {
    req.flash('error', 'Password must be at least 8 characters.');
    return res.redirect('/auth/register');
  }

  const allowedRoles = [User.ROLES.HIRING_MANAGER, User.ROLES.BASIC_USER];
  const selectedRole = allowedRoles.includes(role) ? role : User.ROLES.BASIC_USER;

  try {
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      req.flash('error', 'An account with that email already exists.');
      return res.redirect('/auth/register');
    }
    const existingUsername = await User.findOne({ where: { username } });
    if (existingUsername) {
      req.flash('error', 'That username is already taken.');
      return res.redirect('/auth/register');
    }

    await User.create({ username, email, password, role: selectedRole });
    req.flash('success', 'Registration successful! You can now log in.');
    res.redirect('/auth/login');
  } catch (err) {
    if (err.name === 'SequelizeValidationError') {
      req.flash('error', err.errors.map((e) => e.message).join(', '));
    } else {
      req.flash('error', 'An error occurred during registration. Please try again.');
    }
    res.redirect('/auth/register');
  }
});

// GET /auth/login
router.get('/login', (req, res) => {
  if (req.session.userId) return res.redirect('/demands');
  res.render('auth/login', {
    title: 'Login',
    error: req.flash('error'),
    success: req.flash('success'),
  });
});

// POST /auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    req.flash('error', 'Email and password are required.');
    return res.redirect('/auth/login');
  }

  try {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      req.flash('error', 'Invalid email or password.');
      return res.redirect('/auth/login');
    }

    const valid = await user.verifyPassword(password);
    if (!valid) {
      req.flash('error', 'Invalid email or password.');
      return res.redirect('/auth/login');
    }

    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.userRole = user.role;

    res.redirect('/demands');
  } catch (err) {
    req.flash('error', 'An error occurred. Please try again.');
    res.redirect('/auth/login');
  }
});

// POST /auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/auth/login');
  });
});

module.exports = router;
