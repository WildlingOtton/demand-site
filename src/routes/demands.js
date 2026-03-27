const express = require('express');
const router = express.Router();
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const { Demand, User } = require('../models');
const { requireAuth } = require('../middleware/auth');

// File extension check is a UX-layer guard; csv-parse provides the actual content validation.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.originalname.toLowerCase().endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only .csv files are allowed.'));
    }
  },
});

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

// GET /demands/export - export all demands as CSV
router.get('/export', async (req, res) => {
  try {
    const demands = await Demand.findAll({
      include: [{ model: User, as: 'creator', attributes: ['username'] }],
      order: [['createdAt', 'DESC']],
    });

    const escapeField = (value) => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    };

    const headers = ['id', 'title', 'description', 'department', 'numberOfPositions', 'status', 'createdBy', 'createdAt'];
    const rows = demands.map((demand) =>
      [
        demand.id,
        demand.title,
        demand.description,
        demand.department,
        demand.numberOfPositions,
        demand.status,
        demand.creator ? demand.creator.username : '',
        demand.createdAt.toISOString(),
      ]
        .map(escapeField)
        .join(',')
    );

    const csv = [headers.join(','), ...rows].join('\r\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="demands.csv"');
    return res.send(csv);
  } catch (err) {
    req.flash('error', 'Failed to export demands.');
    res.redirect('/demands');
  }
});

// POST /demands/import - import demands from CSV
router.post(
  '/import',
  (req, res, next) => {
    upload.single('csvFile')(req, res, (err) => {
      if (err) {
        req.flash('error', err.message || 'File upload failed.');
        return res.redirect('/demands');
      }
      next();
    });
  },
  async (req, res) => {
    if (!req.file) {
      req.flash('error', 'No CSV file uploaded.');
      return res.redirect('/demands');
    }

    try {
      const records = parse(req.file.buffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });

      let created = 0;
      const errors = [];
      const validStatuses = Object.values(Demand.STATUS);

      for (const [index, record] of records.entries()) {
        const { title, description, department, numberOfPositions, status } = record;

        if (!title) {
          errors.push(`Row ${index + 2}: title is required`);
          continue;
        }

        const resolvedStatus = validStatuses.includes(status) ? status : Demand.STATUS.OPEN;
        const parsedPositions = parseInt(numberOfPositions, 10);
        const resolvedPositions = Number.isInteger(parsedPositions) && parsedPositions >= 1 ? parsedPositions : 1;

        try {
          await Demand.create({
            title,
            description: description || null,
            department: department || null,
            numberOfPositions: resolvedPositions,
            status: resolvedStatus,
            createdBy: req.session.userId,
          });
          created++;
        } catch (rowErr) {
          if (rowErr.name === 'SequelizeValidationError') {
            errors.push(`Row ${index + 2}: ${rowErr.errors.map((e) => e.message).join(', ')}`);
          } else {
            errors.push(`Row ${index + 2}: failed to create demand`);
          }
        }
      }

      if (created > 0) {
        req.flash('success', `Successfully imported ${created} demand(s).`);
      }
      if (errors.length > 0) {
        req.flash('error', errors.join('; '));
      }
      if (created === 0 && errors.length === 0) {
        req.flash('error', 'No records found in the CSV file.');
      }

      res.redirect('/demands');
    } catch (err) {
      req.flash('error', 'Failed to parse CSV file. Ensure the file has a valid format with a header row.');
      res.redirect('/demands');
    }
  }
);

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
