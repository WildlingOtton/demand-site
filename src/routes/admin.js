const express = require('express');
const router = express.Router();
const { User } = require('../models');
const { requireRole, getSessionUser } = require('../middleware/auth');

// All admin routes require admin role
router.use(requireRole(User.ROLES ? User.ROLES.ADMIN : 'admin'));

// GET /admin/users - list all users
router.get('/users', async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'ASC']],
    });
    res.render('admin/users', {
      title: 'Manage Users',
      users,
      roles: User.ROLES,
      currentUserId: req.session.userId,
      user: getSessionUser(req),
      error: req.flash('error'),
      success: req.flash('success'),
    });
  } catch (err) {
    req.flash('error', 'Failed to load users.');
    res.redirect('/demands');
  }
});

// POST /admin/users/:id/role - update a user's role
router.post('/users/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    const validRoles = Object.values(User.ROLES);
    if (!validRoles.includes(role)) {
      req.flash('error', 'Invalid role selected.');
      return res.redirect('/admin/users');
    }

    const targetUser = await User.findByPk(req.params.id);
    if (!targetUser) {
      req.flash('error', 'User not found.');
      return res.redirect('/admin/users');
    }

    if (targetUser.id === req.session.userId) {
      req.flash('error', 'You cannot change your own role.');
      return res.redirect('/admin/users');
    }

    await targetUser.update({ role });
    req.flash('success', `Role updated for ${targetUser.username}.`);
    res.redirect('/admin/users');
  } catch (err) {
    req.flash('error', 'Failed to update user role.');
    res.redirect('/admin/users');
  }
});

// POST /admin/users/:id/delete - delete a user
router.post('/users/:id/delete', async (req, res) => {
  try {
    const targetUser = await User.findByPk(req.params.id);
    if (!targetUser) {
      req.flash('error', 'User not found.');
      return res.redirect('/admin/users');
    }

    if (targetUser.id === req.session.userId) {
      req.flash('error', 'You cannot delete your own account.');
      return res.redirect('/admin/users');
    }

    await targetUser.destroy();
    req.flash('success', `User ${targetUser.username} deleted.`);
    res.redirect('/admin/users');
  } catch (err) {
    req.flash('error', 'Failed to delete user.');
    res.redirect('/admin/users');
  }
});

module.exports = router;
