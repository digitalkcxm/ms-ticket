require("dotenv").config()

const environment = process.env.STATE_ENV

const knex = require("knex")(require("../../../knexfile")[environment])

module.exports = knex