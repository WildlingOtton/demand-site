'use strict';

const { Sequelize } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '..', 'data', 'demand.sqlite'),
  logging: false,
});

const Demand = require('./Demand')(sequelize);

const db = { sequelize, Sequelize, Demand };

module.exports = db;
