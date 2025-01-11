const { Sequelize } = require('sequelize');

const defineSession = (sequelize) => {
    return sequelize.define('Session', {
        sid: { type: Sequelize.STRING, primaryKey: true },
        data: Sequelize.STRING,
        expires: Sequelize.DATE,
    });
};

module.exports = defineSession;
