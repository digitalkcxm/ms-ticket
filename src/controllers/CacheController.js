import moment from 'moment'

import SLAController from './SLAController.js'
import PhaseModel from '../models/PhaseModel.js'
import TicketModel from '../models/TicketModel.js'
import FormTemplate from '../documents/FormTemplate.js'
import TypeColumnModel from '../models/TypeColumnModel.js'
import ResponsibleModel from '../models/ResponsibleModel.js'
import FormatTicket from '../helpers/FormatTicket.js'

export default class CacheController {
  constructor(database, logger, redisConnection = {}) {
    this.redis = redisConnection
    this.logger = logger
    this.database = database
    this.formTemplate = new FormTemplate(logger)
    this.phaseModel = new PhaseModel(database, logger)
    this.ticketModel = new TicketModel(database, logger)
    this.slaController = new SLAController(database, logger)
    this.typeColumnModel = new TypeColumnModel(database, logger)
    this.responsibleModel = new ResponsibleModel(database, logger)
    this.formatTicket = new FormatTicket(database, logger, redisConnection)
  }

  async cachePhase() {
    const phases = await this.phaseModel.getPhasesForCache()

    for await (const phase of phases) {
      const tickets = await this.ticketModel.getTicketByPhase(phase.id)

      for await (let ticket of tickets) {
        ticket = await this.formatTicket.formatTicketForPhase(phase, ticket)
      }

      await this.redis.set(`msTicket:tickets:${phase.id}`, JSON.stringify(tickets))
    }
    this.logger.info('End create cache tickets.')
  }
}
