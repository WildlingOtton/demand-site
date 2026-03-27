const { DataTypes } = require('sequelize');
const bcrypt = require('bcrypt');

const ROLES = {
  ADMIN: 'admin',
  HIRING_MANAGER: 'hiring_manager',
  BASIC_USER: 'basic_user',
};

module.exports = function (sequelize) {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        len: [3, 50],
        notEmpty: true,
      },
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM(ROLES.ADMIN, ROLES.HIRING_MANAGER, ROLES.BASIC_USER),
      allowNull: false,
      defaultValue: ROLES.BASIC_USER,
    },
  });

  User.prototype.verifyPassword = async function (plaintext) {
    return bcrypt.compare(plaintext, this.password);
  };

  User.prototype.isAdmin = function () {
    return this.role === ROLES.ADMIN;
  };

  User.prototype.isHiringManager = function () {
    return this.role === ROLES.HIRING_MANAGER;
  };

  User.prototype.canEditDemand = function (demand) {
    if (this.role === ROLES.ADMIN || this.role === ROLES.HIRING_MANAGER) {
      return true;
    }
    return demand.createdBy === this.id;
  };

  User.prototype.canDeleteDemand = function () {
    return this.role === ROLES.ADMIN;
  };

  User.beforeCreate(async (user) => {
    user.password = await bcrypt.hash(user.password, 12);
  });

  User.beforeUpdate(async (user) => {
    if (user.changed('password')) {
      user.password = await bcrypt.hash(user.password, 12);
    }
  });

  User.ROLES = ROLES;

  return User;
};
