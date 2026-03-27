'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Demand = sequelize.define(
    'Demand',
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: { notEmpty: true, len: [1, 255] },
      },
      role_type: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          isIn: [
            [
              'software_engineer',
              'systems_engineer',
              'devops_engineer',
              'cyber_engineer',
              'chief_engineer',
              'tester',
              'integrator',
            ],
          ],
        },
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      required_skills: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      priority: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'normal',
        validate: { isIn: [['normal', 'critical']] },
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'open',
        validate: { isIn: [['open', 'filled', 'closed']] },
      },
      clearance_required: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: 'None',
      },
      date_needed: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
    },
    {
      tableName: 'demands',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  return Demand;
};
