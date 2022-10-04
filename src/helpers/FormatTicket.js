import moment from 'moment'
import SLAController from '../controllers/SLAController.js'
import ResponsibleModel from '../models/ResponsibleModel.js'
import TicketModel from '../models/TicketModel.js'

import PhaseModel from '../models/PhaseModel.js'

import FormDocuments from '../documents/FormDocuments.js'

export default class FormatTicket {
  constructor(database = {}, logger = {}, redisConnection = {}) {
    this.redis = redisConnection
    this.slaController = new SLAController(database, logger)
    this.responsibleModel = new ResponsibleModel(database, logger)
    this.ticketModel = new TicketModel(database, logger)
    this.phaseModel = new PhaseModel(database, logger)

    this.formDocuments = new FormDocuments()
  }

  async retriveTicket(ticket, id_phase) {
    ticket = await this.formatTicketForPhase({ id: id_phase }, ticket)

    const removeTk = async function (key, redis) {
      let openTickets = await redis.get(key)

      if (openTickets) {
        openTickets = JSON.parse(openTickets)

        openTickets = await openTickets.filter((x) => x.id !== ticket.id)

        await redis.set(key, JSON.stringify(openTickets))
      }
    }

    const addTk = async function (key, redis) {
      let openTickets = await redis.get(key)
      if (openTickets) {
        openTickets = JSON.parse(openTickets)

        openTickets = openTickets.concat(ticket)

        await redis.set(key, JSON.stringify(openTickets))
      } else {
        await redis.set(key, JSON.stringify([ticket]))
      }
    }

    //@info importante utilizar o phase_id do objeto do ticket, por ser a sua fase atual
    const validationRemove = {
      1: { key: `msTicket:openTickets:${ticket.phase_id}`, func: removeTk },
      2: { key: `msTicket:inProgressTickets:${ticket.phase_id}`, func: removeTk },
      3: { key: `msTicket:closeTickets:${ticket.phase_id}`, func: removeTk }
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

    let cache = await this.redis.get(`msTicket:tickets:${ticket.phase_id}`)

    if (cache) {
      cache = JSON.parse(cache)

      const oldTk = await cache.filter((x) => x.id === ticket.id)

      if (oldTk.length > 0) {
        const key = validationRemove[oldTk[0].id_status].key
        await validationRemove[oldTk[0].id_status].func(key, this.redis)

        const newCacheOldPhase = await cache.filter((x) => x.id !== ticket.id)
        await this.redis.set(`msTicket:tickets:${ticket.phase_id}`, JSON.stringify(newCacheOldPhase))
      }
    }

    const key = validationAdd[ticket.id_status].key
    validationAdd[ticket.id_status].func(key, this.redis)

    let newCacheNewPhase = await this.redis.get(`msTicket:tickets:${id_phase}`)
    if (newCacheNewPhase) {
      newCacheNewPhase = JSON.parse(newCacheNewPhase)
      newCacheNewPhase = newCacheNewPhase.concat({
        id: ticket.id,
        id_seq: ticket.id_seq,
        id_user: ticket.id_user,
        user: ticket.user,
        closed: ticket.closed,
        created_at: ticket.created_at,
        updated_at: ticket.updated_at,
        display_name: ticket.display_name,
        status: ticket.status,
        id_status: ticket.id_status,
        id_tab: ticket.id_tab,
        responsibles: ticket.responsibles,
        form_data: ticket.form_data
      })
      await this.redis.set(`msTicket:tickets:${id_phase}`, JSON.stringify(newCacheNewPhase))
    }

    return ticket
  }

  async formatTicketForPhase(phase, ticket) {
    phase.sla = await this.slaController.settingsSLA(phase.id)
    Object.keys(phase.sla).length > 0 && (ticket.sla = await this.slaController.ticketSLA(phase.id, ticket.id))

    ticket.responsibles = await this.responsibleModel.getActiveResponsibleByTicket(ticket.id)

    const form = await this.ticketModel.getFormTicket(ticket.id)
    if (form && form.length > 0 && form[0].id_form !== '{}') {
      ticket.form_data = await this.formDocuments.findRegister(form[0].id_form)
    }

    ticket.created_at = moment(ticket.created_at).format('DD/MM/YYYY HH:mm:ss')
    ticket.updated_at = moment(ticket.updated_at).format('DD/MM/YYYY HH:mm:ss')
    ticket.time_closed_ticket ? (ticket.time_closed_ticket = moment(ticket.time_closed_ticket).format('DD/MM/YYYY HH:mm:ss')) : ''
    return ticket
  }
}
