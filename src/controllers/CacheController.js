import moment from 'moment'
import asyncRedis from 'async-redis'
const redis = asyncRedis.createClient(process.env.REDIS_PORT, process.env.REDIS_HOST)

import SLAController from './SLAController.js'
import PhaseModel from '../models/PhaseModel.js'
import TicketModel from '../models/TicketModel.js'
import FormTemplate from '../documents/FormTemplate.js'
import TypeColumnModel from '../models/TypeColumnModel.js'
import ResponsibleModel from '../models/ResponsibleModel.js'
import FormatTicket from '../helpers/FormatTicket.js'
export default class CacheController {
  constructor(database, logger) {
    this.logger = logger
    this.database = database
    this.formTemplate = new FormTemplate(logger)
    this.phaseModel = new PhaseModel(database, logger)
    this.ticketModel = new TicketModel(database, logger)
    this.slaController = new SLAController(database, logger)
    this.typeColumnModel = new TypeColumnModel(database, logger)
    this.responsibleModel = new ResponsibleModel(database, logger)
    this.formatTicket = new FormatTicket(database,logger)
  }

  async cachePhase() {
    const phases = await this.phaseModel.getPhasesForCache()

    for await (const phase of phases) {
      const open_tickets = []
      const in_progress_tickets = []
      const closed_tickets = []
      const tickets = await this.ticketModel.getTicketByPhase(phase.id)

      for await (let ticket of tickets) {
        ticket = await this.formatTicket.formatTicketForPhase(phase, ticket)

        ticket.id_status === 1
          ? open_tickets.push(ticket)
          : ticket.id_status === 2
          ? in_progress_tickets.push(ticket)
          : closed_tickets.push(ticket)
      }

      await redis.set(`msTicket:closeTickets:${phase.id}`, JSON.stringify(closed_tickets))

      await redis.set(`msTicket:openTickets:${phase.id}`, JSON.stringify(open_tickets))

      await redis.set(`msTicket:inProgressTickets:${phase.id}`, JSON.stringify(in_progress_tickets))

      await redis.set(`msTicket:tickets:${phase.id}`, JSON.stringify(tickets))
    }
    this.logger.info('End create cache tickets.')
  }
}
