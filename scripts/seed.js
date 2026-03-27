/**
 * Seed script to create an initial admin account.
 * Usage: node scripts/seed.js
 */
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const { sequelize, User } = require('../src/models');

async function seed() {
  await sequelize.sync();

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'AdminPass123!';
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';

  const existing = await User.findOne({ where: { email: adminEmail } });
  if (existing) {
    console.log(`Admin user already exists: ${adminEmail}`);
  } else {
    await User.create({
      username: adminUsername,
      email: adminEmail,
      password: adminPassword,
      role: User.ROLES.ADMIN,
    });
    console.log(`Admin user created: ${adminEmail} / ${adminPassword}`);
    console.log('Please change the admin password after first login!');
  }

  await sequelize.close();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
