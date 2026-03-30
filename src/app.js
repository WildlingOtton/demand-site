require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');
const fs = require('fs');

const { sequelize } = require('./models');
const authRoutes = require('./routes/auth');
const demandsRoutes = require('./routes/demands');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust Railway/Render/Heroku reverse proxy so secure cookies work over HTTPS
app.set('trust proxy', 1);

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

// Routes
app.get('/', (req, res) => {
  if (req.session.userId) return res.redirect('/demands');
  res.redirect('/auth/login');
});

app.use('/auth', authRoutes);
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
  console.error(err);
  res.status(500).render('500', {
    title: 'Server Error',
    user: req.session.userId
      ? { id: req.session.userId, username: req.session.username, role: req.session.userRole }
      : null,
  });
});

// Auto-seed admin user on first startup if none exists
async function seedAdminIfNeeded() {
  const { User } = require('./models');
  const existing = await User.findOne({ where: { role: User.ROLES.ADMIN } });
  if (!existing) {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'AdminPass123!';
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    await User.create({ username: adminUsername, email: adminEmail, password: adminPassword, role: User.ROLES.ADMIN });
    console.log(`Admin user created: ${adminEmail}`);
  }
}

// Sync DB and start server
sequelize
  .sync()
  .then(seedAdminIfNeeded)
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
