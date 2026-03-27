'use strict';

const express = require('express');
const router = express.Router();
const { Demand } = require('../models');
const { DEMAND_TEMPLATES, ROLE_TYPES, ROLE_LABELS } = require('../templates/demandTemplates');

// GET /demands – list all demands
router.get('/', async (req, res, next) => {
  try {
    const demands = await Demand.findAll({ order: [['created_at', 'DESC']] });
    res.render('demands/list', { demands, ROLE_LABELS, title: 'All Demands' });
  } catch (err) {
    next(err);
  }
});

// GET /demands/templates – template selection page
router.get('/templates', (req, res) => {
  res.render('demands/templates', { DEMAND_TEMPLATES, ROLE_TYPES, title: 'Select a Demand Template' });
});

// GET /demands/new?template=<role_type> – new demand form (optionally pre-filled from template)
router.get('/new', (req, res) => {
  const templateKey = req.query.template;
  const template = DEMAND_TEMPLATES[templateKey] || {};
  res.render('demands/new', {
    demand: template,
    ROLE_TYPES,
    ROLE_LABELS,
    title: 'Create New Demand',
    errors: [],
  });
});

// POST /demands – create a new demand
router.post('/', async (req, res, next) => {
  const { title, role_type, description, required_skills, priority, status, clearance_required, date_needed } = req.body;

  const errors = [];
  if (!title || title.trim() === '') errors.push('Title is required.');
  if (!ROLE_TYPES.includes(role_type)) errors.push('A valid role type is required.');
  if (!['normal', 'critical'].includes(priority)) errors.push('Priority must be normal or critical.');

  if (errors.length > 0) {
    return res.status(400).render('demands/new', {
      demand: req.body,
      ROLE_TYPES,
      ROLE_LABELS,
      title: 'Create New Demand',
      errors,
    });
  }

  try {
    await Demand.create({
      title: title.trim(),
      role_type,
      description: description ? description.trim() : null,
      required_skills: required_skills ? required_skills.trim() : null,
      priority,
      status: status || 'open',
      clearance_required: clearance_required ? clearance_required.trim() : 'None',
      date_needed: date_needed || null,
    });
    res.redirect('/demands');
  } catch (err) {
    next(err);
  }
});

// GET /demands/:id – view a single demand
router.get('/:id', async (req, res, next) => {
  try {
    const demand = await Demand.findByPk(req.params.id);
    if (!demand) return res.status(404).render('404', { title: 'Not Found' });
    res.render('demands/view', { demand, ROLE_LABELS, title: demand.title });
  } catch (err) {
    next(err);
  }
});

// GET /demands/:id/edit – edit form
router.get('/:id/edit', async (req, res, next) => {
  try {
    const demand = await Demand.findByPk(req.params.id);
    if (!demand) return res.status(404).render('404', { title: 'Not Found' });
    res.render('demands/edit', {
      demand: demand.toJSON(),
      ROLE_TYPES,
      ROLE_LABELS,
      title: `Edit: ${demand.title}`,
      errors: [],
    });
  } catch (err) {
    next(err);
  }
});

// POST /demands/:id/edit – update a demand
router.post('/:id/edit', async (req, res, next) => {
  const { title, role_type, description, required_skills, priority, status, clearance_required, date_needed } = req.body;

  const errors = [];
  if (!title || title.trim() === '') errors.push('Title is required.');
  if (!ROLE_TYPES.includes(role_type)) errors.push('A valid role type is required.');
  if (!['normal', 'critical'].includes(priority)) errors.push('Priority must be normal or critical.');

  try {
    const demand = await Demand.findByPk(req.params.id);
    if (!demand) return res.status(404).render('404', { title: 'Not Found' });

    if (errors.length > 0) {
      return res.status(400).render('demands/edit', {
        demand: { ...demand.toJSON(), ...req.body },
        ROLE_TYPES,
        ROLE_LABELS,
        title: `Edit: ${demand.title}`,
        errors,
      });
    }

    await demand.update({
      title: title.trim(),
      role_type,
      description: description ? description.trim() : null,
      required_skills: required_skills ? required_skills.trim() : null,
      priority,
      status: status || demand.status,
      clearance_required: clearance_required ? clearance_required.trim() : 'None',
      date_needed: date_needed || null,
    });
    res.redirect(`/demands/${demand.id}`);
  } catch (err) {
    next(err);
  }
});

// POST /demands/:id/delete – delete a demand
router.post('/:id/delete', async (req, res, next) => {
  try {
    const demand = await Demand.findByPk(req.params.id);
    if (!demand) return res.status(404).render('404', { title: 'Not Found' });
    await demand.destroy();
    res.redirect('/demands');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
