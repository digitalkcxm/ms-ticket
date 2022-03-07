import dotenv from "dotenv"

const environment = process.env.STATE_ENV

import knex from "knex"
import knexfile from "../../../knexfile.js"

export default knex(knexfile[environment])

