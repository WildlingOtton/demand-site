const { DataTypes } = require('sequelize');

const STATUS = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  FILLED: 'filled',
  CANCELLED: 'cancelled',
};

module.exports = function (sequelize) {
  const Demand = sequelize.define('Demand', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    demandId: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: [3, 200],
        notEmpty: true,
      },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    department: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    numberOfPositions: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      validate: {
        min: 1,
      },
    },
    status: {
      type: DataTypes.ENUM(STATUS.OPEN, STATUS.IN_PROGRESS, STATUS.FILLED, STATUS.CANCELLED),
      allowNull: false,
      defaultValue: STATUS.OPEN,
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  });

  Demand.STATUS = STATUS;

  Demand.addHook('beforeCreate', async (demand) => {
    const maxRecord = await Demand.max('demandId');
    const next = maxRecord ? parseInt(maxRecord, 10) + 1 : 1;
    demand.demandId = String(next).padStart(5, '0');
  });

  return Demand;
};
