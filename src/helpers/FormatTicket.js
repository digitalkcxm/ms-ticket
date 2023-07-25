import moment from 'moment'
import SLAController from '../controllers/SLAController.js'
import ResponsibleModel from '../models/ResponsibleModel.js'
import TicketModel from '../models/TicketModel.js'

import PhaseModel from '../models/PhaseModel.js'

import FormDocuments from '../documents/FormDocuments.js'
import FormTemplate from '../documents/FormTemplate.js'
import CustomerModel from '../models/CustomerModel.js'
export default class FormatTicket {
  constructor(database = {}, logger = {}, redisConnection = {}) {
    this.redis = redisConnection
    this.slaController = new SLAController(database, logger)
    this.responsibleModel = new ResponsibleModel(database, logger)
    this.ticketModel = new TicketModel(database, logger)
    this.phaseModel = new PhaseModel(database, logger)

    this.formDocuments = new FormDocuments()
    this.formTemplate = new FormTemplate(logger)
    this.customerModel = new CustomerModel(database, logger)
  }


  async formatTicketForPhase(phase, ticket) {
    phase.sla = await this.slaController.settingsSLA(phase.id)

    Object.keys(phase.sla).length > 0 && (ticket.sla = await this.slaController.ticketSLA(phase.id, ticket.id))

    ticket.card_ticket = []

    ticket.responsibles = await this.responsibleModel.getActiveResponsibleByTicket(ticket.id)

    const form = await this.ticketModel.getFormTicket(ticket.id)
    if (form && form.length > 0 && form[0].id_form !== '{}') {
      ticket.form_data = await this.formDocuments.findRegister(form[0].id_form)

      if (!phase.formTemplate && phase.id_form_template) {
        phase.formTemplate = await this.formTemplate.findRegister(phase.id_form_template)
        phase.formTemplate = phase.formTemplate.column
      }

      ticket.form_data && phase.formTemplate
        ? phase.formTemplate.map(
          (x) =>
            x.visible_on_card_ticket &&
            (x.type === 'array' && ticket.form_data[x.column]
              ? ticket.form_data[x.column].map((y) =>
                Object.keys(y).map((z) =>
                  ticket.card_ticket.push({
                    type: 'ticket',
                    value: y[z],
                    label: x.fields.filter((w) => w.column === z)[0].label
                  })
                )
              )
              : ticket.card_ticket.push({
                type: 'ticket',
                value: ticket.form_data[x.column],
                label: x.label
              }))
        )
        : ''
    }

    const customer = await this.customerModel.getAll(ticket.id)
    if (customer && Array.isArray(customer) && customer.length > 0) {
      ticket.customers = customer
    }

    //   ticket.created_at = moment(ticket.created_at).tz(utc).format('DD/MM/YYYY HH:mm:ss')
    //   ticket.updated_at = moment(ticket.updated_at).tz(utc).format('DD/MM/YYYY HH:mm:ss')
    //   ticket.time_closed_ticket ? (ticket.time_closed_ticket = moment(ticket.time_closed_ticket).format('DD/MM/YYYY HH:mm:ss')) : ''
    return ticket
  }
}
