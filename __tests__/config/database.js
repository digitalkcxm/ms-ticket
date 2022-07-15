import dotenv from 'dotenv'
import knex from 'knex'

import knexfile from '../../knexfile.js'
import logger from '../../src/config/logger.js'

logger.info('running pretest script...')

console.log("Configurando Ambiente...")
dotenv.config()
const environment = 'testing'

console.log("Configurando Database...")
const databaseConfig = knexfile[environment]
databaseConfig.connection.database = 'postgres'
let database = knex(databaseConfig)

await database.raw(`DROP DATABASE IF EXISTS ${process.env.DB_TEST}`)
await database.destroy()
console.log('Versão antiga do banco de dados de teste destruída...')

database = knex(databaseConfig)
await database.raw(`CREATE DATABASE ${process.env.DB_TEST} WITH OWNER ${process.env.DB_USERNAME_TEST}`)
await database.destroy()
console.log('Novo banco de dados de teste criada...')

databaseConfig.connection.database = process.env.DB_TEST
database = knex(databaseConfig)
database.migrate.latest().then(async function () {
    logger.info('Migrations successfully created.')
    await database.destroy()
    process.exit()
})
