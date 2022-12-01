import knex from './src/config/database/database.js'
import logger from './src/config/logger.js'
import Redis from './src/config/redis.js'
const redis = Redis.newConnection()
import TicketController from './src/controllers/TicketController.js'

async function teste(data) {
  console.log('data',data)
  const tickets_duplicados = await knex.raw(
    `select * from ticket where display_name = '${data.display_name}' and created_at >= '2022-12-01';`
  )
  console.log('tickets_duplicados',tickets_duplicados.rows)
  if (tickets_duplicados.rows && Array.isArray(tickets_duplicados.rows) && tickets_duplicados.rows.length > 0) {
    for (let index = 0; index < tickets_duplicados.rows.length - 1; index++) {
      const ticket = tickets_duplicados.rows[index]

      await knex.raw(`delete from activities_ticket where id_ticket = '${ticket.id}'`)
      await knex.raw(`delete from attachments_ticket where id_ticket = '${ticket.id}'`)
      await knex.raw(`delete from customer where id_ticket = '${ticket.id}'`)
      await knex.raw(`delete from phase_ticket where id_ticket = '${ticket.id}'`)
      await knex.raw(`delete from responsible_ticket where id_ticket = '${ticket.id}'`)
      await knex.raw(`delete from tab where id_ticket = '${ticket.id}'`)
      await knex.raw(`delete from ticket_protocol where id_ticket = '${ticket.id}'`)
      await knex.raw(`delete from ticket_sla_control where id_ticket = '${ticket.id}'`)
      await knex.raw(`delete from ticket where id = '${ticket.id}'`)
    }
  } else {
    await new TicketController(knex, logger, redis).queueCreate(data)
  }
}

export default teste