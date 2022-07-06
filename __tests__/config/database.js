import dotenv from 'dotenv'
import knex from 'knex'

import {generate_Companies} from '../utils/generateGenericData.js'
import knexfile from '../../knexfile.js'
import logger from '../../src/config/logger.js'

dotenv.config()

logger.info('running pretest script...')

const environment = 'testing'

const databaseConfig = knexfile[environment]
databaseConfig.connection.database = 'postgres'
let database = knex(databaseConfig)

await database.raw(`DROP DATABASE IF EXISTS ${process.env.DB}`)
await database.destroy()
console.log('older version of testing database destroyed.')

database = knex(databaseConfig)
await database.raw(`CREATE DATABASE ${process.env.DB} WITH OWNER ${process.env.DB_USERNAME}`)
console.log('New testing database created.')
await database.destroy()

databaseConfig.connection.database = process.env.DB
database = knex(databaseConfig)
database.migrate.latest().then(async function () {
    logger.info('Migrations successfully created.')
    const result_CompaniesGeneration = await generate_Companies()
    //await database.destroy() //qst: vai destruir a database? ou os dados?
    process.exit()
})
