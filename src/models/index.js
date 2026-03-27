const { Sequelize } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '../../data/database.sqlite'),
  logging: false,
});

const User = require('./User')(sequelize);
const Demand = require('./Demand')(sequelize);

// Associations
User.hasMany(Demand, { foreignKey: 'createdBy', as: 'demands' });
Demand.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });

module.exports = { sequelize, User, Demand };
