import { v1 } from 'uuid'
import moment from 'moment'
import SLAController from './SLAController.js'
import TicketModel from '../models/TicketModel.js'
import { validationResult } from 'express-validator'
import CustomerModel from '../models/CustomerModel.js'
import CallbackDigitalk from '../services/CallbackDigitalk.js'
import PhaseController from '../controllers/PhaseController.js'
import FormatTicket from '../helpers/FormatTicket.js'
import PhaseModel from '../models/PhaseModel.js'

export default class CustomerController {
  constructor(database = {}, logger = {}, redis = {}) {
    this.logger = logger
    this.database = database
    this.ticketModel = new TicketModel(database, logger)
    this.slaController = new SLAController(database, logger)
    this.customerModel = new CustomerModel(database, logger)
    this.phaseController = new PhaseController(database, logger, redis)
    this.formatTicket = new FormatTicket(database, logger, redis)
    this.phaseModel = new PhaseModel(database, logger)
  }

  async create(req, res) {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

    try {
      let obj = {
        id_core: req.body.id_core,
        id_ticket: req.body.id_ticket,
        name: req.body.name,
        email: req.body.email,
        phone: req.body.phone,
        identification_document: req.body.identification_document,
        crm_ids: req.body.crm_ids,
        crm_contact_id: req.body.crm_contact_id,
        created_at: moment().format(),
        updated_at: moment().format()
      }

      const result = await this.customerModel.create(obj)

      if (result.length <= 0) return res.status(400).send({ error: 'Error when manage customer info', result: result })

      if (result.code == '23502') return res.status(400).send({ error: 'Please check your body' })

      // obj.created_at = moment(obj.created_at).format('DD/MM/YYYY HH:mm:ss')
      // obj.updated_at = moment(obj.updated_at).format('DD/MM/YYYY HH:mm:ss')

      let ticket = await this.ticketModel.getTicketById(req.body.id_ticket, req.headers.authorization)
      const phase = await this.phaseModel.getPhaseById(ticket[0].phase_id,  req.headers.authorization)

      ticket = await this.formatTicket.formatTicketForPhase(phase[0], ticket[0])

      await CallbackDigitalk(
        {
          type: 'socket',
          channel: `ticket_${ticket.id}`,
          event: 'update',
          obj: ticket
        },
        req.company[0].callback
      )
      return res.status(200).send(obj)
    } catch (err) {
      this.logger.error(err, 'Error when manager customer info.')
      return res.status(400).send({ error: 'Error when manager customer info' })
    }
  }

  async getByID(req, res) {
    try {
      const result = await this.customerModel.getTicketByIDCRMCustomer(req.query.status, req.params.id, req.query.department)
      if (result.length <= 0) return res.status(400).send({ error: 'Without customer with this ID' })

      const phases = []

      for await (const x of result) {
        if (phases.filter((y) => y.id === x.id).length <= 0) {
          x.phase_sla = await this.slaController.settingsSLA(x.id)
          this.logger.info({
            msg: 'Id da fase na função get by id do customerController',
            data: x.id
          })
          x.sla = await this.slaController.ticketSLA(x.id, x.id_ticket)

          x.header = await this.phaseController.headerGenerate({
            id: x.id,
            authorization: req.body.authorization,
            customer: req.params.id
          })

          const phaseObj = {
            id: x.id,
            department: x.id_department_core,
            emoji: phases.icon,
            sla: x.phase_sla,
            name: x.name,
            order: x.order,
            created_at: x.created_at,
            updated_at: x.updated_at,
            header: x.header,
            ticket: {
              1: {
                total: 0,
                tickets: []
              },
              2: {
                total: 0,
                tickets: []
              },
              3: {
                total: 0,
                tickets: []
              }
            }
          }
          let ticket = {
            closed: x.closed,
            sla: x.sla,
            department_origin: x.department_origin,
            display_name: x.display_name,
            id: x.id_ticket,
            id_seq: x.id_seq,
            id_user: x.id_user,
            status: x.status,
            start_ticket: x.start_ticket, //x.start_ticket ? moment(x.start_ticket).format('DD/MM/YYYY HH:mm:ss') : '',
            created_at: x.created_at_ticket,
            updated_at: x.updated_at_ticket
          }
          ticket = await this.formatTicket.formatTicketForPhase(phaseObj, ticket)
          phaseObj.ticket[x.id_status].tickets.push(ticket)
          phaseObj.ticket[x.id_status].total += 1
          phases.push(phaseObj)
        } else {
          for(const y of phases){
            if (y.id === x.id) {

              let ticket = {
                closed: x.closed,
                department_origin: x.department_origin,
                display_name: x.display_name,
                id: x.id_ticket,
                sla: x.sla,
                id_seq: x.id_seq,
                id_user: x.id_user,
                status: x.status,
                start_ticket: x.start_ticket, //x.start_ticket ? moment(x.start_ticket).format('DD/MM/YYYY HH:mm:ss') : '',
                created_at: x.created_at_ticket,
                updated_at: x.updated_at_ticket
              }
              ticket = await this.formatTicket.formatTicketForPhase(y, ticket)

              y.ticket[x.id_status].tickets.push(ticket)
              y.ticket[x.id_status].total += 1
            }
          }

        }
      }
      return res.status(200).send(phases)
    } catch (err) {
      this.logger.error(err, 'Error when get company info.')
      return res.status(400).send({ error: 'Error when get company info' })
    }
  }

  async getByIDCore(req, res) {
    try {
      const result = await this.customerModel.getByIDCore(req.params.id_core)
      if (result.length <= 0) return res.status(400).send({ error: 'Error when get company info' })

      // result[0].created_at = moment(result[0].created_at).format('DD/MM/YYYY HH:mm:ss')
      // result[0].updated_at = moment(result[0].updated_at).format('DD/MM/YYYY HH:mm:ss')

      return res.status(200).send(result)
    } catch (err) {
      this.logger.error(err, 'Error when get company info.')
      return res.status(400).send({ error: 'Error when get company info' })
    }
  }

  async getByTicket(req, res) {
    try {
      const result = await this.customerModel.getAll(req.body.id_ticket)
      if (result.length <= 0) return res.status(400).send({ error: result })

      // result[0].created_at = moment(result[0].created_at).format('DD/MM/YYYY HH:mm:ss')
      // result[0].updated_at = moment(result[0].updated_at).format('DD/MM/YYYY HH:mm:ss')

      return res.status(200).send(result)
    } catch (err) {
      this.logger.error(err, 'Error when get company info.')
      return res.status(400).send({ error: 'Error when get company info' })
    }
  }

  async update(req, res) {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

    try {
      let obj = {
        name: req.body.name,
        email: req.body.email,
        phone: req.body.phone,
        identification_document: req.body.identification_document,
        crm_ids: req.body.crm_ids,
        crm_contact_id: req.body.crm_contact_id,
        updated_at: moment().format()
      }

      const result = await this.customerModel.update(obj, req.params.id)
      if (result.name && result.name == 'error') return res.status(500).send({ error: 'Contact microservice responsible' })

      return res.status(200).send(result)
    } catch (err) {
      this.logger.error(err, 'Error when manage object to update company.')
      return res.status(400).send({ error: 'Error when manage object to update company' })
    }
  }
}
