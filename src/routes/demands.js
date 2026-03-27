const express = require('express');
const router = express.Router();
const { Demand, User } = require('../models');
const { requireAuth } = require('../middleware/auth');

// All demand routes require authentication
router.use(requireAuth);

// GET /demands - list all demands
router.get('/', async (req, res) => {
  try {
    const demands = await Demand.findAll({
      include: [{ model: User, as: 'creator', attributes: ['username'] }],
      order: [['createdAt', 'DESC']],
    });
    res.render('demands/index', {
      title: 'Demands',
      demands,
      user: {
        id: req.session.userId,
        username: req.session.username,
        role: req.session.userRole,
      },
      error: req.flash('error'),
      success: req.flash('success'),
    });
  } catch (err) {
    req.flash('error', 'Failed to load demands.');
    res.redirect('/demands');
  }
});

// GET /demands/new - show create form
router.get('/new', (req, res) => {
  res.render('demands/form', {
    title: 'New Demand',
    demand: null,
    statuses: Demand.STATUS,
    user: {
      id: req.session.userId,
      username: req.session.username,
      role: req.session.userRole,
    },
    error: req.flash('error'),
  });
});

// POST /demands - create a new demand
router.post('/', async (req, res) => {
  const { title, description, department, numberOfPositions, status } = req.body;

  if (!title) {
    req.flash('error', 'Title is required.');
    return res.redirect('/demands/new');
  }

  try {
    await Demand.create({
      title,
      description,
      department,
      numberOfPositions: numberOfPositions || 1,
      status: status || Demand.STATUS.OPEN,
      createdBy: req.session.userId,
    });
    req.flash('success', 'Demand created successfully.');
    res.redirect('/demands');
  } catch (err) {
    if (err.name === 'SequelizeValidationError') {
      req.flash('error', err.errors.map((e) => e.message).join(', '));
    } else {
      req.flash('error', 'Failed to create demand.');
    }
    res.redirect('/demands/new');
  }
});

// GET /demands/:id/edit - show edit form
router.get('/:id/edit', async (req, res) => {
  try {
    const demand = await Demand.findByPk(req.params.id);
    if (!demand) {
      req.flash('error', 'Demand not found.');
      return res.redirect('/demands');
    }

    const currentUser = await User.findByPk(req.session.userId);
    if (!currentUser || !currentUser.canEditDemand(demand)) {
      req.flash('error', 'You do not have permission to edit this demand.');
      return res.redirect('/demands');
    }

    res.render('demands/form', {
      title: 'Edit Demand',
      demand,
      statuses: Demand.STATUS,
      user: {
        id: req.session.userId,
        username: req.session.username,
        role: req.session.userRole,
      },
      error: req.flash('error'),
    });
  } catch (err) {
    req.flash('error', 'Failed to load demand.');
    res.redirect('/demands');
  }
});

// POST /demands/:id - update a demand
router.post('/:id', async (req, res) => {
  try {
    const demand = await Demand.findByPk(req.params.id);
    if (!demand) {
      req.flash('error', 'Demand not found.');
      return res.redirect('/demands');
    }

    const currentUser = await User.findByPk(req.session.userId);
    if (!currentUser || !currentUser.canEditDemand(demand)) {
      req.flash('error', 'You do not have permission to edit this demand.');
      return res.redirect('/demands');
    }

    const { title, description, department, numberOfPositions, status } = req.body;

    if (!title) {
      req.flash('error', 'Title is required.');
      return res.redirect(`/demands/${req.params.id}/edit`);
    }

    await demand.update({ title, description, department, numberOfPositions, status });
    req.flash('success', 'Demand updated successfully.');
    res.redirect('/demands');
  } catch (err) {
    if (err.name === 'SequelizeValidationError') {
      req.flash('error', err.errors.map((e) => e.message).join(', '));
    } else {
      req.flash('error', 'Failed to update demand.');
    }
    res.redirect(`/demands/${req.params.id}/edit`);
  }
});

// POST /demands/:id/delete - delete a demand (admin only)
router.post('/:id/delete', async (req, res) => {
  try {
    const currentUser = await User.findByPk(req.session.userId);
    if (!currentUser || !currentUser.canDeleteDemand()) {
      req.flash('error', 'Only admins can delete demands.');
      return res.redirect('/demands');
    }

    const demand = await Demand.findByPk(req.params.id);
    if (!demand) {
      req.flash('error', 'Demand not found.');
      return res.redirect('/demands');
    }

    await demand.destroy();
    req.flash('success', 'Demand deleted successfully.');
    res.redirect('/demands');
  } catch (err) {
    req.flash('error', 'Failed to delete demand.');
    res.redirect('/demands');
  }
});

module.exports = router;
