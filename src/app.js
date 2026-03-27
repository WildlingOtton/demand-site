require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');
const fs = require('fs');
const { csrfSync } = require('csrf-sync');
const rateLimit = require('express-rate-limit');

const { sequelize } = require('./models');
const authRoutes = require('./routes/auth');
const demandsRoutes = require('./routes/demands');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure data directory exists
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

// Body parsing
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Session
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'change-this-secret-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24, // 24 hours
    },
  })
);

// Flash messages
app.use(flash());

// CSRF protection (synchronizer token pattern, requires session)
const { generateToken, csrfSynchronisedProtection } = csrfSync({
  getTokenFromRequest: (req) =>
    req.body && req.body._csrf ? req.body._csrf : undefined,
});
app.use(csrfSynchronisedProtection);

// Make CSRF token available to all views
app.use((req, res, next) => {
  res.locals.csrfToken = generateToken(req);
  next();
});

// Auth rate limiting – max 20 attempts per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests, please try again later.',
});

// Routes
app.get('/', (req, res) => {
  if (req.session.userId) return res.redirect('/demands');
  res.redirect('/auth/login');
});

app.use('/auth', authLimiter, authRoutes);
app.use('/demands', demandsRoutes);
app.use('/admin', adminRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).render('404', {
    title: 'Page Not Found',
    user: req.session.userId
      ? { id: req.session.userId, username: req.session.username, role: req.session.userRole }
      : null,
  });
});

// Error handler
app.use((err, req, res, _next) => {
  if (err.status === 403 && err.message && err.message.toLowerCase().includes('csrf')) {
    req.flash('error', 'Session expired or invalid request. Please try again.');
    return res.redirect('back');
  }
  console.error(err);
  res.status(500).render('500', {
    title: 'Server Error',
    user: req.session.userId
      ? { id: req.session.userId, username: req.session.username, role: req.session.userRole }
      : null,
  });
});

// Sync DB and start server
sequelize
  .sync()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Demand Site running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to database:', err);
    process.exit(1);
  });

module.exports = app;
