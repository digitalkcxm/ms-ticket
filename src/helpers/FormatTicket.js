import moment from 'moment'
import SLAController from '../controllers/SLAController.js'
import ResponsibleModel from '../models/ResponsibleModel.js'
import TicketModel from '../models/TicketModel.js'
import asyncRedis from 'async-redis'
const redis = asyncRedis.createClient(process.env.REDIS_PORT, process.env.REDIS_HOST)
export default class FormatTicket {
  constructor(database = {}, logger = {}) {
    this.slaController = new SLAController(database, logger)
    this.responsibleModel = new ResponsibleModel(database, logger)
    this.ticketModel = new TicketModel(database, logger)
  }

  async retriveTicket(ticket, id_phase) {
    ticket = await this.formatTicketForPhase({ id: id_phase }, ticket)

    const removeTk = async function (key) {
      let openTickets = await redis.get(key)
      openTickets = JSON.parse(openTickets)
      openTickets = await openTickets.filter((x) => x.id !== ticket.id)

      await redis.set(key, JSON.stringify(openTickets))
    }

    const addTk = async function (key) {
      let openTickets = await redis.get(key)
      openTickets = JSON.parse(openTickets)

      openTickets = openTickets.concat(ticket)

      console.log(await redis.set(key, JSON.stringify(openTickets)))
    }

    //@info importante utilizar o phase_id do objeto do ticket, por ser a sua fase atual
    const validationRemove = {
      1: removeTk(`msTicket:openTickets:${ticket.phase_id}`),
      2: removeTk(`msTicket:inProgressTickets:${ticket.phase_id}`),
      3: removeTk(`msTicket:closeTickets:${ticket.phase_id}`)
    }

    //@info importante utilizar o paramêtro id_phase, pois se for o caso de uma transferência ele atualiza no cache da nova fase.
    const validationAdd = {
      1: {
        key: `msTicket:openTickets:${id_phase}`,
        func: addTk
      },
      2: {
        key: `msTicket:inProgressTickets:${id_phase}`,
        func: addTk
      },
      3: {
        key: `msTicket:closeTickets:${id_phase}`,
        func: addTk
      }
    }

    let cache = await redis.get(`msTicket:tickets:${id_phase}`)
    cache && (cache = JSON.parse(cache))

    const oldTk = await cache.filter((x) => x.id === ticket.id)

    if (oldTk.length > 0) await validationRemove[oldTk[0].id_status]

    console.log('ticket', ticket)
    const key = validationAdd[ticket.id_status].key
    validationAdd[ticket.id_status].func(key)
    return ticket
  }

  async formatTicketForPhase(phase, ticket) {
    phase.sla = await this.slaController.settingsSLA(phase.id)
    Object.keys(phase.sla).length > 0 && (ticket.sla = await this.slaController.ticketSLA(phase.id, ticket.id))

    ticket.responsibles = await this.responsibleModel.getActiveResponsibleByTicket(ticket.id)
    ticket.created_at = moment(ticket.created_at).format('DD/MM/YYYY HH:mm:ss')
    ticket.updated_at = moment(ticket.updated_at).format('DD/MM/YYYY HH:mm:ss')

    return ticket
  }
}
