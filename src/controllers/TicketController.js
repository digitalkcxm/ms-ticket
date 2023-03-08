import { v1 } from 'uuid'
import moment from 'moment'

import cache from '../helpers/Cache.js'
import TabModel from '../models/TabModel.js'
import SLAModel from '../models/SLAModel.js'
import UserModel from '../models/UserModel.js'
import SLAController from './SLAController.js'
import UserController from './UserController.js'
import PhaseModel from '../models/PhaseModel.js'
import TicketModel from '../models/TicketModel.js'
import CompanyModel from '../models/CompanyModel.js'
import CustomerModel from '../models/CustomerModel.js'
import FormTemplate from '../documents/FormTemplate.js'
import FormDocuments from '../documents/FormDocuments.js'
import ActivitiesModel from '../models/ActivitiesModel.js'
import TypeColumnModel from '../models/TypeColumnModel.js'
import ResponsibleModel from '../models/ResponsibleModel.js'
import DepartmentController from './DepartmentController.js'
import AttachmentsModel from '../models/AttachmentsModel.js'
import CallbackDigitalk from '../services/CallbackDigitalk.js'
import FormatTicket from '../helpers/FormatTicket.js'
import Notify from '../helpers/Notify.js'
const sla_status = {
  emdia: 1,
  atrasado: 2,
  aberto: 3
}

export default class TicketController {
  constructor(database = {}, logger = {}, redisConnection = {}) {
    this.redis = redisConnection
    this.logger = logger
    this.database = database
    this.tabModel = new TabModel(database)
    this.formTemplate = new FormTemplate(logger)
    this.slaModel = new SLAModel(database, logger)
    this.userModel = new UserModel(database, logger)
    this.phaseModel = new PhaseModel(database, logger)
    this.ticketModel = new TicketModel(database, logger)
    this.formatTicket = new FormatTicket(database, logger, redisConnection)
    this.companyModel = new CompanyModel(database, logger)
    this.slaController = new SLAController(database, logger)
    this.customerModel = new CustomerModel(database, logger)
    this.userController = new UserController(database, logger)
    this.typeColumnModel = new TypeColumnModel(database, logger)
    this.activitiesModel = new ActivitiesModel(database, logger)
    this.attachmentsModel = new AttachmentsModel(database, logger)
    this.responsibleModel = new ResponsibleModel(database, logger)
    this.departmentController = new DepartmentController(database, logger)
  }
  //Remover assim que função da fila funcionar direitinho

  async queueCreate(data) {
    try {
      const companyVerified = await this.companyModel.getByIdActive(data.authorization)
      if (!companyVerified || companyVerified.length <= 0) return false

      let id_user = await this.userController.checkUserCreated(
        data.id_user,
        data.authorization,
        data.name ? data.name : '',
        data.phone ? data.phone : '',
        data.email ? data.email : '',
        data.type_user ? data.type_user : 1
      )

      console.log(id_user)
      let obj = {
        id: v1(),
        id_company: data.authorization,
        id_user: id_user.id,
        created_at: moment().format(),
        updated_at: moment().format(),
        display_name: data.display_name,
        status: 'Aberto'
      }

      if (data.department_origin) {
        const department = await this.departmentController.checkDepartmentCreated(data.department_origin, data.authorization)
        obj.department_origin = department[0].id
      }

      let phase = await this.phaseModel.getPhaseById(data.id_phase, data.authorization)
      if (!phase || phase.length <= 0) return false

      obj.id_phase = data.id_phase
      obj.phase = phase[0].name
      if (data.form && Object.keys(data.form).length > 0 && phase[0].form) {
        if ((await this._validateForm(global.mongodb, phase[0].id_form_template, data.form).length) > 0) return false
        obj.id_form = await new FormDocuments(global.mongodb).createRegister(data.form)
      }

      if (data.id_ticket_father) {
        const ticketFather = await this.ticketModel.getTicketById(data.id_ticket_father, data.authorization)
        if (ticketFather && Array.isArray(ticketFather) && ticketFather.length > 0) {
          obj.id_ticket_father = ticketFather[0].id
          obj.created_by_ticket = true
        }
      }
      if (data.id_protocol) {
        obj.id_protocol = data.id_protocol
        obj.protocol_pattern = data.protocol_pattern
        obj.created_by_protocol = true
      }

      let result = await this.ticketModel.create(obj)

      //@info esse update é realizado após a criação, porquê é necessario ter o ID sequencial para dar "nome" ao ticket.
      if (!data.display_name || data.display_name === '')
        await this.ticketModel.updateTicket({ display_name: `ticket#${result[0].id_seq}` }, result[0].id, data.authorization)

      if (data.responsible) await this._createResponsibles(data.responsible, obj.id, data.authorization, id_user)

      if (data.customer) await this._createCustomers(data.customer, obj.id)

      let phase_id = await this.ticketModel.createPhaseTicket({
        id_phase: phase[0].id,
        id_ticket: obj.id,
        id_user: id_user.id,
        id_form: obj.id_form
      })

      if (!phase_id || phase_id.length <= 0) return false

      let ticket = await this.ticketModel.getTicketById(obj.id, data.authorization)

      if (result && result.length > 0 && result[0].id) {
        await this.slaController.createSLAControl(phase[0].id, obj.id)

        ticket = await this.formatTicket.retriveTicket(ticket[0], phase[0].id)
        if (data.id_user !== -1) await cache(data.authorization, phase[0].id_department, ticket.phase_id, this)
        await CallbackDigitalk(
          {
            type: 'socket',
            channel: `phase_${phase[0].id}`,
            event: 'new_ticket',
            obj: ticket
          },
          companyVerified[0].callback
        )
        await Notify(ticket.id, phase[0].id, data.authorization, 'open', companyVerified[0].callback, {
          phaseModel: this.phaseModel,
          ticketModel: this.ticketModel,
          customerModel: this.customerModel
        })

        return ticket
      }
      return false
    } catch (err) {
      console.log('Error when generate object to save ticket => ', err)
      return false
    }
  }

  async _createResponsibles(userResponsible = null, ticket_id, authorization, act_user) {
    try {
      if (Array.isArray(userResponsible) && userResponsible.length > 0) {
        for (const user of userResponsible) {
          let id_user = await this.userController.checkUserCreated(
            user.id_user,
            authorization,
            user.name ? user.name : '',
            user.phone ? user.phone : '',
            user.email ? user.email : '',
            1
          )

          await this.ticketModel.createResponsibleTicket({
            id_ticket: ticket_id,
            id_user: id_user.id,
            id_type_of_responsible: 2,
            active: true,
            created_at: moment().add(1, 'seconds'),
            updated_at: moment().add(1, 'seconds'),
            id_user_add: act_user.id
          })
        }
      }

      return true
    } catch (err) {
      console.log('Error when create responsibles ==> ', err)
      return false
    }
  }

  async _createCustomers(customer = null, ticket_id) {
    try {
      // await this.customerModel.delCustomerTicket(ticket_id);
      // if (customer.length > 0) {
      //   for (let c of customer) {
      await this.customerModel.create({
        id_core: customer.id_core,
        id_ticket: ticket_id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        identification_document: customer.identification_document,
        crm_ids: customer.crm_ids,
        crm_contact_id: customer.crm_contact_id,
        created_at: moment().format(),
        updated_at: moment().format()
      })
      //   }
      // }
      return true
    } catch (err) {
      console.log('Error when create responsibles ==> ', err)
      return false
    }
  }

  async queueCreateActivities(data) {
    try {
      const companyVerified = await this.companyModel.getByIdActive(data.authorization)

      if (!companyVerified || companyVerified.length <= 0) return false

      if (!data.id_user) return false

      const name = data.name ? data.name : ''
      const phone = data.phone ? data.phone : ''
      const email = data.email ? data.email : ''
      const type_user = data.type_user ? data.type_user : 1
      let user = await this.userController.checkUserCreated(data.id_user, data.authorization, name, phone, email, type_user)

      if (!user || !user.id) return false

      let ticket = await this.ticketModel.getTicketById(data.id_ticket, data.authorization)
      if (!ticket || ticket.length <= 0) return false

      let objUpdateTicket = {
        updated_at: moment().format()
      }
      if (!ticket[0].closed) {
        objUpdateTicket = {
          ...objUpdateTicket,
          id_status: 2,
          status: 'Em atendimento'
        }

        ticket[0].id_status = 2
      }

      if (!ticket[0].start_ticket) {
        await Notify(ticket[0].id, ticket[0].phase_id, data.authorization, 'start_activity', companyVerified[0].callback, {
          phaseModel: this.phaseModel,
          ticketModel: this.ticketModel,
          customerModel: this.customerModel
        })
        objUpdateTicket = { ...objUpdateTicket, start_ticket: moment() }
      }

      await this.ticketModel.updateTicket(objUpdateTicket, data.id_ticket, data.authorization)

      let obj = {
        text: data.text,
        id_ticket: data.id_ticket,
        id_user: user.id,
        created_at: moment().format(),
        updated_at: moment().format()
      }

      let result = await this.activitiesModel.create(obj)
      console.log('teste')
      if (result && result.length > 0) {
        await this.slaController.updateSLA(data.id_ticket, ticket[0].phase_id, 2)

        obj = {
          id: result[0].id,
          id_seq: ticket[0].id_seq,
          message: data.text,
          id_user: data.id_user,
          type: 'note',
          source: user.source,
          name: user.name,
          created_at: moment(obj.created_at).format('DD/MM/YYYY HH:mm:ss'),
          updated_at: moment(obj.updated_at).format('DD/MM/YYYY HH:mm:ss')
        }

        const phase = await this.phaseModel.getPhaseById(ticket[0].phase_id, data.authorization)
        ticket[0] = await this.formatTicket.retriveTicket(ticket[0], phase[0].id)

        await cache(data.authorization, phase[0].id_department, ticket[0].phase_id, this)
        await CallbackDigitalk(
          {
            type: 'socket',
            channel: `ticket_${ticket[0].id}`,
            event: 'activity',
            obj
          },
          companyVerified[0].callback
        )
        await Notify(ticket[0].id, ticket[0].phase_id, data.authorization, 'progress', companyVerified[0].callback, {
          phaseModel: this.phaseModel,
          ticketModel: this.ticketModel,
          customerModel: this.customerModel
        })
        return obj
      }

      return false
    } catch (err) {
      console.log('Error manage object to create activities => ', err)
      return false
    }
  }

  async queueCreateAttachments(data) {
    try {
      const companyVerified = await this.companyModel.getByIdActive(data.authorization)

      if (!companyVerified || companyVerified.length <= 0) return false

      if (!data.id_user) return false

      let user = await this.userController.checkUserCreated(
        data.id_user,
        data.authorization,
        data.name ? data.name : '',
        data.phone ? data.phone : '',
        data.email ? data.email : '',
        data.type_user ? data.type_user : 1
      )

      if (!user || !user.id) return false

      let ticket = await this.ticketModel.getTicketById(data.id_ticket, data.authorization)
      if (!ticket || ticket.length <= 0) return false

      let objUpdateTicket = {
        updated_at: moment().format()
      }
      console.log(ticket)
      if (!ticket[0].closed) {
        objUpdateTicket = {
          ...objUpdateTicket,
          id_status: 2,
          status: 'Em atendimento'
        }

        ticket[0].id_status = 2
      }

      if (!ticket[0].start_ticket) {
        await Notify(ticket[0].id, ticket[0].phase_id, data.authorization, 'start_activity', companyVerified[0].callback, {
          phaseModel: this.phaseModel,
          ticketModel: this.ticketModel,
          customerModel: this.customerModel
        })

        objUpdateTicket = { ...objUpdateTicket, start_ticket: moment() }
      }

      await this.ticketModel.updateTicket(objUpdateTicket, data.id_ticket, data.authorization)

      let typeAttachments = await this.ticketModel.getTypeAttachments(data.type)

      if (!typeAttachments || typeAttachments.length <= 0) return false

      let obj = {
        id_user: user.id,
        id_ticket: data.id_ticket,
        url: data.url,
        type: typeAttachments[0].id,
        name: data.file_name,
        created_at: moment(),
        updated_at: moment()
      }

      let result = await this.attachmentsModel.create(obj)

      await this.slaController.updateSLA(data.id_ticket, ticket[0].phase_id, 2)

      if (result && result.length > 0) {
        obj.id = result[0].id

        obj.created_at = moment(obj.created_at).format('DD/MM/YYYY HH:mm:ss')
        obj.updated_at = moment(obj.updated_at).format('DD/MM/YYYY HH:mm:ss')
        obj.type = 'file'
        obj.id_user = data.id_user

        const dashPhase = await this.phaseModel.getPhaseById(ticket[0].phase_id, data.authorization)

        ticket[0] = await this.formatTicket.retriveTicket(ticket[0], dashPhase[0].id)

        await cache(data.authorization, dashPhase[0].id_department, ticket[0].phase_id, this)

        await CallbackDigitalk(
          {
            type: 'socket',
            channel: `ticket_${ticket[0].id}`,
            event: 'activity',
            obj: obj
          },
          companyVerified[0].callback
        )

        await Notify(ticket[0].id, ticket[0].phase_id, data.authorization, 'first_reply', companyVerified[0].callback, {
          phaseModel: this.phaseModel,
          ticketModel: this.ticketModel,
          customerModel: this.customerModel
        })
        return true
      }

      return false
    } catch (err) {
      console.log('Error manage object to create attachments => ', err)
      return false
    }
  }

  async getTicketByID(req, res) {
    try {
      let result = await this.ticketModel.getTicketByIdSeq(req.params.id, req.headers.authorization)
      if (result.name && result.name == 'error') return res.status(400).send({ error: 'There was an error' })

      if (result && result.length <= 0) return res.status(400).send({ error: 'There is no ticket with this ID' })

      result = await this.formatTicket.formatTicketForPhase({ id: result[0].phase_id }, result[0])
      const customer = await this.customerModel.getAll(result.id)
      if (customer && Array.isArray(customer) && customer.length > 0) {
        result.customers = customer
      }

      const protocols = await this.ticketModel.getProtocolTicket(result.id, req.headers.authorization)

      if (protocols && Array.isArray(protocols) && protocols.length > 0) {
        result.protocols = protocols
      }

      result.activities = await this._activities(result.id, req.app.locals.db, req.headers.authorization, result.id_tab)

      result.activities.sort((a, b) => {
        if (moment(a.created_at, 'DD/MM/YYYY HH:mm:ss').format('X') === moment(b.created_at, 'DD/MM/YYYY HH:mm:ss').format('X')) {
          return a.id
        } else {
          return moment(a.created_at, 'DD/MM/YYYY HH:mm:ss').format('X') - moment(b.created_at, 'DD/MM/YYYY HH:mm:ss').format('X')
        }
      })

      const department = await this.phaseModel.getDepartmentPhase(result.phase_id)
      result.actual_department = department[0].id_department

      if (result.form_data) {
        const phase = await this.phaseModel.getPhaseById(result.phase_id, req.headers.authorization)
        if (phase[0].form && phase[0].id_form_template) {
          const register = await this.formTemplate.findRegister(phase[0].id_form_template)

          if (register && register.column) {
            result.form_template = register.column

            for (const x of result.form_template) {
              let type
              if (!isNaN(x.type)) {
                type = await this.typeColumnModel.getTypeByID(x.type)
              } else {
                type = await this.typeColumnModel.getTypeByName(x.type)
              }

              type && Array.isArray(type) && type.length > 0 ? (x.type = type[0].name) : ''
            }
          }
        }
      }

      result.responsibles = await this.responsibleModel.getActiveResponsibleByTicket(result.id)
      result.responsibles.map((x) => {
        delete x.created_at
        delete x.updated_at
        delete x.active
        delete x.id
      })

      return res.status(200).send(result)
    } catch (err) {
      console.log('Error when select ticket by id =>', err)
      return res.status(400).send({ error: 'There was an error' })
    }
  }

  async getTicket(req, res) {
    try {
      let result = await this.ticketModel.getTicketById(req.params.id, req.headers.authorization)
      if (result.name && result.name == 'error') return res.status(400).send({ error: 'There was an error' })

      if (result && result.length <= 0) return res.status(400).send({ error: 'There is no ticket with this ID' })

      result = await this.formatTicket.formatTicketForPhase({ id: result[0].phase_id }, result[0], this.database, this.logger)
      const customer = await this.customerModel.getAll(result.id)
      if (customer && Array.isArray(customer) && customer.length > 0) {
        result.customers = customer
      }

      const protocols = await this.ticketModel.getProtocolTicket(result.id, req.headers.authorization)
      console.log('protocols =>', protocols)
      if (protocols && Array.isArray(protocols) && protocols.length > 0) {
        result.protocols = protocols[0]
      }

      result.activities = await this._activities(result.id, req.app.locals.db, req.headers.authorization, result.id_tab)

      result.activities.sort((a, b) => {
        if (moment(a.created_at, 'DD/MM/YYYY HH:mm:ss').format('x') === moment(b.created_at, 'DD/MM/YYYY HH:mm:ss').format('x')) {
          return a.id
        } else {
          return moment(a.created_at, 'DD/MM/YYYY HH:mm:ss').format('x') - moment(b.created_at, 'DD/MM/YYYY HH:mm:ss').format('x')
        }
      })

      const department = await this.phaseModel.getDepartmentPhase(result.phase_id)
      result.actual_department = department[0].id_department

      const form = await this.ticketModel.getFormTicket(result.id)

      if (form && form.length > 0 && form[0].id_form) {
        const phase = await this.phaseModel.getPhaseById(form[0].id_phase, req.headers.authorization)
        if (phase[0].form && phase[0].id_form_template) {
          const register = await this.formTemplate.findRegister(phase[0].id_form_template)

          if (register && register.column) {
            result.form_template = register.column

            for (const x of result.form_template) {
              const type = await this.typeColumnModel.getTypeByName(x.type)

              type && Array.isArray(type) && type.length > 0 ? (x.type = type[0].name) : ''
            }
          }
        }
        result.form_data = await new FormDocuments(req.app.locals.db).findRegister(form[0].id_form)
        delete result.form_data._id
      }

      result.responsibles = await this.responsibleModel.getActiveResponsibleByTicket(result.id)
      result.responsibles.map((x) => {
        delete x.created_at
        delete x.updated_at
        delete x.active
        delete x.id
      })
      return res.status(200).send(result)
    } catch (err) {
      console.log('Error when select ticket by id =>', err)
      return res.status(400).send({ error: 'There was an error' })
    }
  }

  async _activities(id_ticket, db, id_company, tab = false) {
    const obj = []

    const activities = await this.activitiesModel.getActivities(id_ticket)
    activities.map((value) => {
      value.created_at = moment(value.created_at).format('DD/MM/YYYY HH:mm:ss')
      value.updated_at = moment(value.updated_at).format('DD/MM/YYYY HH:mm:ss')
      value.type = 'note'
      obj.push(value)
    })

    const attachments = await this.attachmentsModel.getAttachments(id_ticket)
    attachments.map((value) => {
      value.created_at = moment(value.created_at).format('DD/MM/YYYY HH:mm:ss')
      value.updated_at = moment(value.updated_at).format('DD/MM/YYYY HH:mm:ss')
      value.type = 'file'
      obj.push(value)
    })

    let history_phase = await this.ticketModel.getHistoryTicket(id_ticket)
    for (let index in history_phase) {
      index = parseInt(index)

      if (history_phase[index + 1]) {
        const before = await new FormDocuments(db).findRegister(history_phase[index].id_form)

        const templateBefore = await this.formTemplate.findRegister(history_phase[index].template)

        const after = await new FormDocuments(db).findRegister(history_phase[index + 1].id_form)

        const templateAfter = await this.formTemplate.findRegister(history_phase[index + 1].template)

        obj.push({
          before: {
            phase: history_phase[index + 1].id_phase,
            field: templateAfter ? templateAfter.column : {},
            value: after
          },
          after: {
            phase: history_phase[index].id_phase,
            field: templateBefore ? templateBefore.column : {},
            value: before
          },
          type: 'change_form',
          id_user: history_phase[index].id_user,
          created_at: moment(history_phase[index].created_at).format('DD/MM/YYYY HH:mm:ss'),
          updated_at: moment(history_phase[index].updated_at).format('DD/MM/YYYY HH:mm:ss')
        })

        if (history_phase[index].id_phase != history_phase[index + 1].id_phase) {
          obj.push({
            type: 'move',
            id_user: history_phase[index].id_user,
            phase_dest: {
              id: history_phase[index].id_phase,
              name: history_phase[index].name
            },
            phase_origin: {
              id: history_phase[index + 1].id_phase,
              name: history_phase[index + 1].name
            },
            created_at: moment(history_phase[index].created_at).format('DD/MM/YYYY HH:mm:ss')
          })
        }
      }
      const slas = await this.slaModel.getSLAControl(history_phase[index].id_phase, id_ticket)
      for (const sla of slas) {
        obj.push({
          id_phase: history_phase[index].id_phase,
          name: history_phase[index].name,
          status: sla.status,
          id_sla_status: sla.id_sla_status,
          sla_type: sla.type,
          id_sla_type: sla.id_sla_type,
          limit_sla_time: moment(sla.limit_sla_time).format('DD/MM/YYYY HH:mm:ss'),
          interaction_time: sla.interaction_time ? moment(sla.interaction_time).format('DD/MM/YYYY HH:mm:ss') : '',
          created_at: sla.created_at
            ? moment(sla.created_at).format('DD/MM/YYYY HH:mm:ss')
            : moment(history_phase[index + 1].updated_at).format('DD/MM/YYYY HH:mm:ss'),
          type: 'sla'
        })
      }
    }

    const view_ticket = await this.ticketModel.getViewTicket(id_ticket)
    view_ticket.map((value) => {
      value.start = moment(value.start).format('DD/MM/YYYY HH:mm:ss')
      value.end ? (value.end = moment(value.end).format('DD/MM/YYYY HH:mm:ss')) : ''
      value.created_at = value.start
      value.type = 'view'
      obj.push(value)
    })

    const create_protocol = await this.ticketModel.getProtocolCreatedByTicket(id_ticket, id_company)
    create_protocol.map((value) => {
      value.created_at = moment(value.created_at).format('DD/MM/YYYY HH:mm:ss')
      value.updated_at = moment(value.updated_at).format('DD/MM/YYYY HH:mm:ss')
      value.type = 'create_protocol'
      obj.push(value)
    })

    const create_ticket = await this.ticketModel.getTicketCreatedByTicketFather(id_ticket, id_company)
    create_ticket.map((value) => {
      value.created_at = moment(value.created_at).format('DD/MM/YYYY HH:mm:ss')
      value.type = 'create_ticket'
      obj.push(value)
    })

    const ticket = await this.ticketModel.getStatusTicketById(id_ticket, id_company)
    if (ticket[0].created_by_ticket) {
      const ticketFather = await this.ticketModel.getTicketById(ticket[0].id_ticket_father, id_company)
      obj.push({
        type: 'start',
        created_at: moment(ticket[0].created_at).format('DD/MM/YYYY HH:mm:ss'),
        ticket: ticketFather[0].id_seq,
        id_user: ticket[0].id_user
      })
    } else if (ticket[0].created_by_protocol) {
      obj.push({
        type: 'start',
        created_at: moment(ticket[0].created_at).format('DD/MM/YYYY HH:mm:ss'),
        protocol: ticket[0].id_protocol,
        id_user: ticket[0].id_user
      })
    } else {
      obj.push({
        type: 'start',
        created_at: moment(ticket[0].created_at).format('DD/MM/YYYY HH:mm:ss'),
        id_user: ticket[0].id_user
      })
    }
    if (ticket[0].status === 3 && ticket[0].user_closed_ticket) {
      const user = await this.userModel.getById(ticket[0].user_closed_ticket, id_company)
      obj.push({
        type: 'closed',
        created_at: moment(ticket[0].time_closed_ticket).format('DD/MM/YYYY HH:mm:ss'),
        id_user: user[0].id_users
      })
    }

    if (tab) {
      const tab = await this.tabModel.getByTicket(id_ticket)
      if (Array.isArray(tab) && tab.length > 0) {
        obj.push({
          type: 'tab',
          id_ticket: id_ticket,
          id_tab: tab[0].id_tab,
          description: tab[0].description,
          id_user: tab[0].id_user,
          created_at: moment(tab[0].created_at).format('DD/MM/YYYY HH:mm:ss')
        })
      }
    }

    const responsaveis = await this.responsibleModel.getAllResponsibleByTicket(id_ticket)
    for (const responsavel of responsaveis) {
      let user_add = ''
      if (responsavel.id_user_add) user_add = await this.userModel.getById(responsavel.id_user_add, id_company)

      obj.push({
        type: 'add_responsible',
        id_ticket: id_ticket,
        id_user: responsavel.id_user,
        name: responsavel.name,
        id_user_add: user_add ? user_add[0].id_user : responsavel.id_user,
        user_add: user_add ? user_add[0].name : responsavel.name,
        created_at: moment(responsavel.created_at).format('DD/MM/YYYY HH:mm:ss')
      })

      if (!responsavel.active) {
        let user_remove = ''
        if (responsavel.id_user_remove) user_remove = await this.userModel.getById(responsavel.id_user_remove, id_company)
        obj.push({
          type: 'remove_responsible',
          id_ticket: id_ticket,
          id_user: responsavel.id_user,
          name: responsavel.name,
          id_user_remove: user_remove ? user_remove[0].id_user : responsavel.id_user,
          user_remove: user_remove ? user_remove[0].name : responsavel.name,
          created_at: moment(responsavel.updated_at).format('DD/MM/YYYY HH:mm:ss')
        })
      }
    }
    return obj
  }

  async getAllTicket(req, res) {
    console.log('@INFO getAllTicket query =>', req.query)
    try {
      let obj = {}
      req.query.department ? (obj.department = JSON.parse(req.query.department)) : ''
      req.query.users ? (obj.users = JSON.parse(req.query.users)) : ''
      req.query.closed ? (obj.closed = JSON.parse(req.query.closed)) : (obj.closed = [true, false])
      if (req.query.range) {
        obj.range = req.query.range.split(',')
        obj.range = obj.range.map((x) => x.replace('[', '').replace(']', ''))
      } else {
        obj.range = [moment().format('YYYY-MM-DD'),  moment().format('YYYY-MM-DD')]
      }
      obj.history_phase = req.query.history_phase
      req.query.rows && (obj.rows = req.query.rows)

      req.query.offset &&
        obj.rows &&
        (obj.offset = obj.rows * (parseInt(req.query.offset) != 0 ? parseInt(req.query.offset) - 1 : req.query.offset))
      const result = await this.ticketModel.getAllTickets(req.headers.authorization, obj)

      if (result.name && result.name == 'error') return res.status(400).send({ error: 'There was an error' })

      if (!result && result.length <= 0) return res.status(400).send({ error: 'There are no tickets' })

      const tickets = []
      for (const ticket of result) {
        if (ticket.id_phase) {
          const ticketFormated = await this.formatTicket.formatTicketForPhase({ id: ticket.id_phase }, ticket)

          //@info REGRA DE NEGOCIO DE COMGAS!
          if (req.headers.authorization === '04c42a90-f0e3-11ec-afda-f705ff2ac16e') {
            const form = await this.ticketModel.getFormTicketFromComgas(ticketFormated.id)

            if (form && form.length > 0 && form[0].id_form) {
              const form_data = await new FormDocuments(req.app.locals.db).findRegister(form[0].id_form)
              ticketFormated.customer = form_data['Nome_do_condomínio'] ? form_data['Nome_do_condomínio'] : form_data['CNPJ_do_condomínio']
              ticketFormated.identification_document = form_data['CNPJ_do_condomínio']
              ticketFormated.phone = form_data.Telefone
              ticketFormated.email = form_data['E-mail']
            } else if (ticketFormated.form_data) {
              ticketFormated.customer = ticketFormated.form_data['Nome_do_condomínio']
                ? ticketFormated.form_data['Nome_do_condomínio']
                : ticketFormated.form_data['CNPJ_do_condomínio']
              ticketFormated.identification_document = ticketFormated.form_data['CNPJ_do_condomínio']
            }
          }
          //@info sla formatado dessa forma para apresentar no analitico do ticket. favor não mexer sem consultar o Rafael ou o Silas.
          if (ticketFormated.sla) {
            const keys = Object.keys(ticketFormated.sla)
            if (keys.length > 0) {
              const sla = keys.pop()
              ticketFormated.countSLA = ticketFormated.sla[sla].status
              ticketFormated.sla_time = ticketFormated.sla[sla].limit_sla_time
            }
          }
          tickets.push(ticketFormated)
        }
      }

      return res.status(200).send(tickets)
    } catch (err) {
      console.log('Error when select ticket by id =>', err)
      return res.status(400).send({ error: 'There was an error' })
    }
  }

  async queueUpdateTicket(data) {
    try {
      const companyVerified = await this.companyModel.getByIdActive(data.authorization)

      if (!companyVerified || companyVerified.length <= 0) return false

      let ticket = await this.ticketModel.getTicketById(data.id, data.authorization)

      if (!ticket || ticket.length <= 0) return false

      let obj = {
        updated_at: moment().format(),
        display_name: data.display_name ? data.display_name : ticket[0].display_name
      }

      ticket = ticket[0]

      let phase = await this.phaseModel.getPhaseById(data.id_phase, data.authorization)

      if (!phase || phase.length <= 0) return false

      obj.id_phase = data.id_phase
      obj.phase = phase[0].name

      await this.slaController.updateSLA(ticket.id, ticket.phase_id, 2)
      const oldPhase = ticket.phase_id
      console.log(oldPhase, phase[0].id)
      //@info oldPhase === fase atual | phase[0].id === fase destino
      if (oldPhase != phase[0].id) {
        if (data.form) {
          if (Object.keys(data.form).length > 0) {
            if (phase[0].form) {
              let errors = await this._validateForm(global.mongodb, phase[0].id_form_template, data.form)
              if (errors.length > 0) return res.status(400).send({ errors: errors })

              obj.id_form = await new FormDocuments(global.mongodb).createRegister(data.form)
            }
          }
        }
        const user = await this.userController.checkUserCreated(
          data.id_user,
          data.authorization,
          data.name ? data.name : '',
          data.phone ? data.phone : '',
          data.email ? data.email : '',
          data.type_user ? data.type_user : 1
        )
        await this.phaseModel.disablePhaseTicket(data.id)

        let phase_id = await this.ticketModel.createPhaseTicket({
          id_phase: phase[0].id,
          id_ticket: data.id,
          id_user: user.id,
          id_form: obj.id_form
        })
        if (!phase_id || phase_id.length <= 0) return false

        await this.slaController.createSLAControl(phase[0].id, data.id)

        await CallbackDigitalk(
          {
            type: 'socket',
            channel: `phase_${ticket.phase_id}`,
            event: 'move_ticket_old_phase',
            obj: { id: ticket.id, id_phase: ticket.phase_id }
          },
          companyVerified[0].callback
        )

        await CallbackDigitalk(
          {
            type: 'socket',
            channel: `phase_${phase[0].id}`,
            event: 'move_ticket_new_phase',
            obj: { ...ticket, created_at: moment(ticket.created_at).format('DD/MM/YYYY HH:mm:ss'), phase_id: phase[0].id }
          },
          companyVerified[0].callback
        )

        await CallbackDigitalk(
          {
            type: 'socket',
            channel: `ticket_${ticket.id}`,
            event: 'activity',
            obj: {
              type: 'move',
              id_user: data.id_user,
              phase_dest: {
                id: phase[0].id,
                name: phase[0].name
              },
              phase_origin: {
                id: ticket.phase_id,
                name: ticket.phase
              },
              created_at: moment().format('DD/MM/YYYY HH:mm:ss')
            }
          },
          companyVerified[0].callback
        )

        await Notify(ticket.id, phase[0].id, data.authorization, 'alter_phase', companyVerified[0].callback, {
          phaseModel: this.phaseModel,
          ticketModel: this.ticketModel,
          customerModel: this.customerModel
        })

        await cache(data.authorization, phase[0].id_department, phase[0].id, this)
      } else {
        if (data.form && Object.keys(data.form).length > 0) {
          const firstPhase = await this.ticketModel.getFirstFormTicket(ticket.id)
          if (firstPhase[0].form) {
            let errors = await this._validateUpdate(global.mongodb, firstPhase[0].id_form_template, data.form, firstPhase[0].id_form)
            console.log('errors ====>', errors)
            if (errors.length > 0) return false

            const resultUpdate = await new FormDocuments(global.mongodb).updateRegister(firstPhase[0].id_form, data.form)
            console.log(resultUpdate)
          }
        }
      }
      await cache(data.authorization, phase[0].id_department, ticket.phase_id, this)

      await Notify(ticket.id, phase[0].id, data.authorization, 'progress', companyVerified[0].callback, {
        phaseModel: this.phaseModel,
        ticketModel: this.ticketModel,
        customerModel: this.customerModel
      })
      if (!ticket.start_ticket) {
        await Notify(ticket.id, phase[0].id, data.authorization, 'start_activity', companyVerified[0].callback, {
          phaseModel: this.phaseModel,
          ticketModel: this.ticketModel,
          customerModel: this.customerModel
        })

        obj.start_ticket = moment()
        obj.id_status = 2
        obj.status = 'Em atendimento'
      }
      delete obj.id_form

      const result = await this.ticketModel.updateTicket(obj, data.id, data.authorization)
      const getTicket = await this.ticketModel.getTicketById(data.id, data.authorization)

      ticket = await this.formatTicket.retriveTicket(getTicket[0], oldPhase)

      if (ticket.phase_id === phase[0].id) {
        await CallbackDigitalk(
          {
            type: 'socket',
            channel: `phase_${data.id_phase}`,
            event: 'update_ticket',
            obj: ticket
          },
          companyVerified[0].callback
        )
      }

      await CallbackDigitalk(
        {
          type: 'socket',
          channel: `ticket_${ticket.id}`,
          event: 'update',
          obj: ticket
        },
        companyVerified[0].callback
      )

      await this.redis.del(`ticket:phase:${data.authorization}`)
      if (result) return true

      return false
    } catch (err) {
      console.log('Error when generate object to save ticket => ', err)
      return false
    }
  }

  async closedTicket(req, res) {
    try {
      const user = await this.userController.checkUserCreated(
        req.body.id_user,
        req.headers.authorization,
        req.body.name ? req.body.name : '',
        req.body.phone ? req.body.phone : '',
        req.body.email ? req.body.email : '',
        req.body.type_user ? req.body.type_user : 1
      )
      const result = await this.ticketModel.closedTicket(req.params.id, user.id)

      if (result && result[0].id) {
        let ticket = await this.ticketModel.getTicketById(req.params.id, req.headers.authorization)
        await this.redis.del(`msTicket:${req.headers.authorization}:closeTickets:${ticket[0].phase_id}`)

        await this.slaController.updateSLA(ticket[0].id, ticket[0].phase_id, 3)

        await this.slaModel.disableSLA(ticket[0].id)
        const phase = await this.phaseModel.getPhaseById(ticket[0].phase_id, req.headers.authorization)

        ticket[0] = await this.formatTicket.retriveTicket(ticket[0], phase[0].id)

        await Notify(ticket[0].id, ticket[0].phase_id, req.headers.authorization, 'close', req.company[0].callback, {
          phaseModel: this.phaseModel,
          ticketModel: this.ticketModel,
          customerModel: this.customerModel
        })

        await CallbackDigitalk(
          {
            type: 'socket',
            channel: `phase_${ticket[0].phase_id}`,
            event: 'update_ticket',
            obj: ticket[0]
          },
          req.company[0].callback
        )
        await CallbackDigitalk(
          {
            type: 'socket',
            channel: `ticket_${ticket[0].id}`,
            event: 'update',
            obj: ticket[0]
          },
          req.company[0].callback
        )

        await cache(req.headers.authorization, phase[0].id_department, ticket[0].phase_id, this)

        return res.status(200).send(ticket[0])
      }

      await this.redis.del(`ticket:phase:${req.headers.authorization}`)

      return res.status(400).send({ error: 'There was an error' })
    } catch (err) {
      console.log('Error when finaly ticket =>', err)
      return res.status(400).send({ error: 'There was an error' })
    }
  }

  async cronCheckSLA(req, res) {
    const tickets = await this.slaModel.checkSLA(req.params.type)
    if (tickets && Array.isArray(tickets) && tickets.length > 0) {
      switch (req.params.type) {
        case 1:
          for (const ticket of tickets) {
            if (!ticket.interaction_time && ticket.limit_sla_time < moment().utc()) {
              await this.slaModel.updateTicketSLA(
                ticket.id_ticket,
                { id_sla_status: sla_status.atrasado, active: false },
                ticket.id_sla_type,
                ticket.id_phase
              )
            }
          }
          break
        case '2':
          for (const ticket of tickets) {
            if (!ticket.interaction_time && ticket.limit_sla_time < moment().utc()) {
              await this.slaModel.updateTicketSLA(
                ticket.id_ticket,
                { id_sla_status: sla_status.atrasado, active: false },
                ticket.id_sla_type,
                ticket.id_phase
              )
              const ticketInfo = await this.ticketModel.getTicketToCronSLA(ticket.id_ticket)
              const companyInfo = await this.companyModel.getByIdActive(ticketInfo[0].id_company)
              await Notify(ticket.id_ticket, ticket.id_phase, companyInfo[0].id, 'first_reply', companyInfo[0].callback, {
                phaseModel: this.phaseModel,
                ticketModel: this.ticketModel,
                customerModel: this.customerModel
              })
            }
          }
          break
        case 3:
          for (const ticket of tickets) {
            if (ticket.limit_sla_time < moment().utc()) {
              await this.slaModel.updateTicketSLA(
                ticket.id_ticket,
                { id_sla_status: sla_status.atrasado, active: false },
                ticket.id_sla_type,
                ticket.id_phase
              )
            }
          }
          break
        default:
          break
      }
    }
    res.status(200).send(true)
  }

  async checkSLA(type) {
    const tickets = await this.slaModel.checkSLA(type)
    if (tickets && Array.isArray(tickets) && tickets.length > 0) {
      switch (type) {
        case 1:
          for (const ticket of tickets) {
            if (!ticket.interaction_time && ticket.limit_sla_time < moment()) {
              console.log('1')
              await this.slaModel.updateTicketSLA(
                ticket.id_ticket,
                { id_sla_status: sla_status.atrasado },
                ticket.id_sla_type,
                ticket.id_phase
              )
            }
          }
          break
        case 2:
          for (const ticket of tickets) {
            if (ticket.interaction_time < ticket.limit_sla_time && ticket.limit_sla_time < moment()) {
              await this.slaModel.updateTicketSLA(
                ticket.id_ticket,
                { id_sla_status: sla_status.atrasado },
                ticket.id_sla_type,
                ticket.id_phase
              )
            }
          }
          break
        case 3:
          for (const ticket of tickets) {
            if (ticket.limit_sla_time < moment()) {
              await this.slaModel.updateTicketSLA(
                ticket.id_ticket,
                { id_sla_status: sla_status.atrasado },
                ticket.id_sla_type,
                ticket.id_phase
              )
            }
          }
          break
        default:
          break
      }
    }
  }

  async processCase(result) {
    let ticketTime
    let timeNow = moment()

    switch (result.unit_of_time) {
      case 1:
        ticketTime = moment(result.updated_at)
        timeNow = timeNow.diff(ticketTime, 'seconds')
        break
      case 2:
        ticketTime = moment(result.updated_at)
        timeNow = timeNow.diff(ticketTime, 'minutes')

        break
      case 3:
        ticketTime = moment(result.updated_at)
        timeNow = timeNow.diff(ticketTime, 'hours')
        break
      case 4:
        ticketTime = moment(result.updated_at)
        timeNow = timeNow.diff(ticketTime, 'days')
        break
      default:
        ticketTime = moment(result.updated_at)
        timeNow = timeNow.diff(ticketTime, 'hours')
        break
    }
    return timeNow
  }

  async _validateForm(db, id_form_template, form) {
    try {
      const errors = []

      console.log(id_form_template)
      const form_template = await this.formTemplate.findRegister(id_form_template)
      console.log(form_template)
      for (let column of form_template.column) {
        column.required && !form[column.column] && column.active !== false ? errors.push(`O campo ${column.column} é obrigatório`) : ''
      }

      const formColumns = Object.keys(form)
      for (const column of formColumns) {
        form_template.column.filter((x) => x.column === column).length > 0
          ? ''
          : errors.push(`O campo ${column} não faz parte desse template`)
      }
      return errors
    } catch (err) {
      console.log('Error when generate Doc =>', err)
      return err
    }
  }

  async _validateUpdate(db, id_form_template, form, id_form_ticket) {
    try {
      const errors = []
      const form_template = await this.formTemplate.findRegister(id_form_template)

      const form_register = await new FormDocuments(db).findRegister(id_form_ticket)
      // for (let column of form_template.column) {
      //   console.log(column)
      //   column.required && form[column.column]
      //     ? ""
      //     : errors.push(`O campo ${column.label} é obrigatório`);

      //   if (form[column.column] != form_register[column.column])
      //     !column.editable && form[column.column]
      //       ? errors.push(`O campo ${column.label} não é editavel`)
      //       : "";
      // }
      return errors
    } catch (err) {
      console.log('Error when generate Doc =>', err)
      return err
    }
  }

  async getTicketByCustomerOrProtocol(req, res) {
    try {
      let result = await this.ticketModel.getTicketByCustomerOrProtocol(req.params.id, req.headers.authorization)
      for (let ticket of result) {
        ticket = await this.formatTicket.formatTicketForPhase({ id: ticket.phase_id }, ticket, this.database, this.logger)

        const sla_status = function (sla) {
          if (sla) {
            let status = ''
            const keys = Object.keys(sla)
            for (const key of keys) {
              if (sla[key].status === 'Em dia') {
                return 'Em dia'
              } else {
                status = sla[key].status
              }
            }
            return status
          } else {
            return ''
          }
        }
        ticket.sla_status = sla_status(ticket.sla)
        ticket.history_phase = await this.ticketModel.getHistoryTicket(ticket.id)
        ticket.history_phase.map((value) => {
          value.created_at = moment(value.created_at).format('DD/MM/YYYY HH:mm:ss')
        })
      }

      if (!result && result.length <= 0) return res.status(400).send({ error: 'There was an error' })

      return res.status(200).send(result)
    } catch (err) {
      console.log('====>', err)
      return res.status(400).send({ error: 'There was an error' })
    }
  }

  async ticketStatusCount(req, res) {
    try {
      const id_company = req.headers.authorization
      let result = await this.ticketModel.getTicketStatusCount(id_company)

      let retorno
      if (result.length && result.length > 0 && result[0].id_company.length > 0) {
        retorno = {
          tickets_abertos: parseInt(result[0].tickets_abertos),
          tickets_respondidos: parseInt(result[0].tickets_respondidos),
          tickets_atrasados: parseInt(result[0].tickets_atrasados)
        }
      } else {
        retorno = {
          tickets_abertos: 0,
          tickets_respondidos: 0,
          tickets_atrasados: 0
        }
      }

      return res.status(200).json(retorno)
    } catch (err) {
      console.log('status ====>', err)
      return res.status(400).send({ error: 'There was an error while trying to obtain status' })
    }
  }

  async ticketResponsibleCount(req, res) {
    try {
      const id_company = req.headers.authorization

      let obj = {}
      req.query.department ? (obj.department = JSON.parse(req.query.department)) : ''
      req.query.users ? (obj.users = JSON.parse(req.query.users)) : ''
      req.query.closed ? (obj.closed = JSON.parse(req.query.closed)) : (obj.closed = [true, false])
      req.query.range ? (obj.range = JSON.parse(req.query.range)) : ''

      let result = await this.ticketModel.getCountResponsibleTicket(id_company, obj)

      if (result.name && result.name == 'error') return res.status(400).send({ error: 'There was an error' })

      if (!result && result.length <= 0) return res.status(400).send({ error: 'There are no tickets' })

      let response = []
      if (result.length && result.length > 0) {
        for (let obj of result) {
          response.push({
            id_user: obj.id_user,
            count: parseInt(obj.count)
          })
        }
      }

      return res.status(200).json(response)
    } catch (err) {
      console.log('status ====>', err)
      return res.status(400).send({ error: 'There was an error while trying to obtain status' })
    }
  }

  async startTicket(req, res) {
    try {
      if (!req.body.id_ticket || !req.body.id_user) return res.status(400).send({ error: 'Houve um erro! ' })

      const result = await this.userController.checkUserCreated(
        req.body.id_user,
        req.headers.authorization,
        req.body.name ? req.body.name : '',
        req.body.phone ? req.body.phone : '',
        req.body.email ? req.body.email : '',
        req.body.type_user ? req.body.type_user : 1
      )

      const time = moment()
      const responsibleCheck = await this.ticketModel.getResponsibleByTicketAndUser(req.body.id_ticket, result.id)

      const ticket = await this.ticketModel.getTicketById(req.body.id_ticket, req.headers.authorization)

      if (ticket && ticket.length > 0 && !ticket[0].start_ticket) {
        ticket[0].start_ticket = time
        await this.ticketModel.updateTicket(
          { start_ticket: time, id_status: 2, status: 'Em atendimento' },
          req.body.id_ticket,
          req.headers.authorization
        )

        await this.slaController.updateSLA(req.body.id_ticket, ticket[0].phase_id, 1)
      }

      const phase = await this.phaseModel.getPhaseById(ticket[0].phase_id, req.headers.authorization)

      ticket[0].id_status = 2
      ticket[0] = await this.formatTicket.retriveTicket(ticket[0], phase[0].id)

      await cache(req.headers.authorization, phase[0].id_department, ticket[0].phase_id, this)

      await Notify(ticket[0].id, ticket[0].phase_id, req.headers.authorization, 'start_activity', req.company[0].callback, {
        phaseModel: this.phaseModel,
        ticketModel: this.ticketModel,
        customerModel: this.customerModel
      })
      await CallbackDigitalk(
        {
          type: 'socket',
          channel: `phase_${ticket[0].id_phase}`,
          event: 'update_ticket',
          obj: ticket[0]
        },
        req.company[0].callback
      )
      await CallbackDigitalk(
        {
          type: 'socket',
          channel: `ticket_${ticket[0].id}`,
          event: 'update',
          obj: ticket[0]
        },
        req.company[0].callback
      )

      if (responsibleCheck && Array.isArray(responsibleCheck) && responsibleCheck.length > 0 && !responsibleCheck[0].start_ticket) {
        return res.status(200).send({ start_ticket: moment(time).format('DD/MM/YYYY HH:mm:ss') })
      } else if (responsibleCheck && Array.isArray(responsibleCheck) && responsibleCheck.length <= 0) {
        await this.ticketModel.createResponsibleTicket({
          id_ticket: req.body.id_ticket,
          id_user: result.id,
          id_type_of_responsible: 2,
          start_ticket: time,
          active: true,
          id_user_add: result.id
        })
        return res.status(200).send({ start_ticket: moment(time).format('DD/MM/YYYY HH:mm:ss') })
      } else if (responsibleCheck && Array.isArray(responsibleCheck) && responsibleCheck.length > 0 && responsibleCheck[0].start_ticket) {
        return res.status(400).send({
          error: 'Não é possivel iniciar um ticket já inicializado'
        })
      }
    } catch (err) {
      console.log('err', err)
      return res.status(500).send({ error: 'Houve um erro! ' })
    }
  }

  async linkProtocolToTicket(req, res) {
    try {
      if (!req.body.id_ticket || !req.body.id_protocol || !req.body.id_user) return res.status(400).send({ error: 'Houve algum problema' })

      const ticket = await this.ticketModel.getTicketById(req.body.id_ticket, req.headers.authorization)

      if (!ticket || ticket.length < 0) return res.status(400).send({ error: 'Houve algum problema' })

      const user = await this.userController.checkUserCreated(
        req.body.id_user,
        req.headers.authorization,
        req.body.name ? req.body.name : '',
        req.body.phone ? req.body.phone : '',
        req.body.email ? req.body.email : '',
        req.body.type_user ? req.body.type_user : 1
      )
      if (!user) return res.status(400).send({ error: 'Houve algum problema' })

      const obj = {
        id_ticket: ticket[0].id,
        id_protocol: req.body.id_protocol,
        id_company: req.headers.authorization,
        created_at: moment().format(),
        updated_at: moment().format(),
        id_user: user.id,
        created_by_ticket: req.body.created_by_ticket
      }

      const result = await this.ticketModel.linkProtocolToticket(obj)

      ticket[0] = await this.formatTicket.retriveTicket(ticket[0], ticket[0].phase_id)

      if (result.length <= 0) return res.status(400).send({ error: 'Houve algum problema' })

      obj.created_at = moment(obj.created_at).format('DD/MM/YYYY HH:mm:ss')
      obj.updated_at = moment(obj.updated_at).format('DD/MM/YYYY HH:mm:ss')
      return res.status(200).send(obj)
    } catch (err) {
      console.log('linkProtocolToTicket ====>', err)
      return res.status(400).send({ error: 'Houve algum problema' })
    }
  }

  async viewTicket(req, res) {
    try {
      if (!req.body.id_ticket || !req.body.id_user || !req.body.type) return res.status(400).send({ error: 'Houve algum problema' })

      const user = await this.userController.checkUserCreated(
        req.body.id_user,
        req.headers.authorization,
        req.body.name ? req.body.name : '',
        req.body.phone ? req.body.phone : '',
        req.body.email ? req.body.email : '',
        req.body.type_user ? req.body.type_user : 1
      )

      if (!user) return res.status(400).send({ error: 'Houve algum problema' })

      const ticket = await this.ticketModel.getTicketById(req.body.id_ticket, req.headers.authorization)

      if (!ticket || ticket.length < 0) return res.status(400).send({ error: 'Houve algum problema' })

      const obj = {
        id_ticket: ticket[0].id,
        start: null,
        end: null,
        id_user: user.id
      }
      switch (req.body.type) {
        case 'start':
          obj.start = moment().format()
          break
        case 'end':
          obj.end = moment().format()
          break
        default:
          console.log('tipo não mapeado')
          break
      }

      const result = await this.ticketModel.insertViewTicket(obj)
      if (!result) return res.status(400).send({ error: 'Houve algum problema' })

      await this.formatTicket.retriveTicket(ticket[0], ticket[0].phase_id)
      return res.status(200).send(obj)
    } catch (err) {
      console.log('Error view ticket =>', err)
      return res.status(400).send({ error: 'Houve algum problema' })
    }
  }

  async history_ticket(req, res) {
    try {
      const ticket = await this.ticketModel.getTicketById(req.params.id, req.headers.authorization)

      if (!ticket || !Array.isArray(ticket)) return res.status(400).send({ error: 'Houve algum problema' })

      const history = []

      const slaInfo = await this.formatTicket.formatTicketForPhase({ id: ticket[0].phase_id }, ticket[0], this.database, this.logger)

      const sla_status = function (sla) {
        if (sla) {
          let status = ''
          const keys = Object.keys(sla)
          for (const key of keys) {
            if (sla[key].status === 'Aberto') {
              return 'Aberto'
            } else {
              status = sla[key].status
            }
          }
          return status
        } else {
          return ''
        }
      }

      history.push({
        id_seq: ticket[0].id_seq,
        id_user: ticket[0].id_user,
        user: ticket[0].name,
        created_at: ticket[0].created_at,
        closed: ticket[0].closed,
        department_origin: ticket[0].department_origin,
        phase_name: ticket[0].phase,
        display_name: ticket[0].display_name,
        id_protocol: ticket[0].id_protocol,
        type: 'ticket',
        sla_status: sla_status(slaInfo.sla),
        status: ticket[0].status,
        customer: await this.customerModel.getAll(ticket[0].id),
        id_tab: ticket[0].id_tab
      })

      if (ticket[0].id_protocol) {
        history.push({
          id: ticket[0].id_protocol,
          type: 'protocol'
        })
      }

      const father_ticket = await this.ticketModel.getTicketById(ticket[0].id_ticket_father, req.headers.authorization)
      if (father_ticket && father_ticket.length > 0) {
        history.push({
          id_seq: father_ticket[0].id_seq,
          id_user: father_ticket[0].id_user,
          user: father_ticket[0].name,
          created_at: moment(father_ticket[0].created_at).format('DD/MM/YYYY HH:mm:ss'),
          closed: father_ticket[0].closed,
          department_origin: father_ticket[0].department_origin,
          phase_name: father_ticket[0].phase,
          display_name: father_ticket[0].display_name,
          id_protocol: father_ticket[0].id_protocol,
          type: 'ticket',
          status: father_ticket[0].status,
          customer: await this.customerModel.getAll(father_ticket[0].id),
          id_tab: father_ticket[0].id_tab
        })
      }

      const protocols = await this.ticketModel.getProtocolTicket(req.params.id, req.headers.authorization)
      if (protocols && protocols.length > 0) {
        for (const protocol of protocols) {
          history.push({
            id: protocol.id_protocol,
            type: 'protocol'
          })
        }
      }

      return res.status(200).send(history)
    } catch (err) {
      console.log('Error history_ticket =>', err)
      return res.status(500).send({ error: 'Houve algum problema' })
    }
  }

  async tab(req, res) {
    try {
      const ticket = await this.ticketModel.getTicketById(req.body.id_ticket, req.headers.authorization)
      if (ticket.length <= 0) return res.status(500).send({ error: 'Não existe ticket com esse ID.' })

      if (!ticket[0].id_tab) {
        let id_user = await this.userController.checkUserCreated(
          req.body.id_user,
          req.headers.authorization,
          req.body.name ? req.body.name : '',
          req.body.phone ? req.body.phone : '',
          req.body.email ? req.body.email : '',
          req.body.type_user ? req.body.type_user : 1
        )
        const new_tab = await this.tabModel.create({
          id_user: id_user.id,
          id_ticket: req.body.id_ticket,

          id_tab: req.body.id_tab,
          description: req.body.description
        })

        if (Array.isArray(new_tab) && new_tab.length > 0 && new_tab[0].id) {
          await this.ticketModel.updateTicket(
            { id_tab: req.body.id_tab, updated_at: moment().format() },
            req.body.id_ticket,
            req.headers.authorization
          )

          await this.formatTicket.retriveTicket(ticket[0], ticket[0].phase_id)

          return res.status(200).send({
            id_ticket: req.body.id_ticket,
            id_tab: req.body.id_tab
          })
        }

        return res.status(400).send({ error: 'Erro ao criar a tabulção.' })
      } else {
        return res.status(400).send({ error: 'Ticket já foi tabulado.' })
      }
    } catch (err) {
      console.log('tab err ====> ', err)
      return res.status(500).send({ error: 'Ocorreu um erro ao tabular o ticket.' })
    }
  }
}
