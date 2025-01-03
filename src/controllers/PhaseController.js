import { v1 } from 'uuid'
import moment from 'moment'
import cache from '../helpers/Cache.js'
import SLAModel from '../models/SLAModel.js'
import SLAController from './SLAController.js'
import PhaseModel from '../models/PhaseModel.js'
import UserController from './UserController.js'
import TicketModel from '../models/TicketModel.js'
import { validationResult } from 'express-validator'
import FormTemplate from '../documents/FormTemplate.js'
import FormDocuments from '../documents/FormDocuments.js'
import DepartmentModel from '../models/DepartmentModel.js'
import TypeColumnModel from '../models/TypeColumnModel.js'
import DepartmentController from './DepartmentController.js'
import templateValidate from '../helpers/TemplateValidate.js'
import CallbackDigitalk from '../services/CallbackDigitalk.js'
import FormatTicket from '../helpers/FormatTicket.js'

import DashController from './DashController.js'
export default class PhaseController {
  constructor(database = {}, logger = {}, redisConnection = {}) {
    this.redis = redisConnection
    this.logger = logger
    this.database = database
    this.formDocuments = new FormDocuments()
    this.formTemplate = new FormTemplate(logger)
    this.slaModel = new SLAModel(database, logger)
    this.phaseModel = new PhaseModel(database, logger)
    this.ticketModel = new TicketModel(database, logger)
    this.formatTicket = new FormatTicket(database, logger, redisConnection)
    this.slaController = new SLAController(database, logger)
    this.userController = new UserController(database, logger)
    
    this.typeColumnModel = new TypeColumnModel(database, logger)
    this.departmentModel = new DepartmentModel(database, logger)
    this.departmentController = new DepartmentController(database, logger)
    this.dashController = new DashController(database)
  }
  async create(req, res) {
    // Validação do corpo da requisição.
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

    try {
      // const usersResponsible = [];
      // const usersNotify = [];

      let obj = {
        id: v1(),
        id_company: req.headers.authorization,
        icon: req.body.icon,
        name: req.body.name,
        form: req.body.form,
        created_at: moment().format(),
        updated_at: moment().format(),
        active: req.body.active,
        visible_new_ticket: req.body.visible_new_ticket,
        notification_customer: req.body.customer,
        notification_admin: req.body.admin,
        notification_separate: { separate: req.body.separate },
        notification_responsible: req.body.responsible,
        department_can_create_protocol: {
          department: req.body.department_can_create_protocol
        },
        department_can_create_ticket: {
          department: req.body.department_can_create_ticket
        },
        create_protocol: req.body.create_protocol,
        create_ticket: req.body.create_ticket
      }
      // Executa uma validação no formulario passado pelo cliente.

      if (req.body.form) {
        const templateValidate = await this._formPhase(req.body.column)

        if (templateValidate.error) return res.status(400).send(templateValidate)

        this.logger.info('Return of validate template', templateValidate)
        obj.id_form_template = templateValidate
      }

      // Cria a estrutura base da fase.
      let phaseCreated = await this.phaseModel.createPhase(obj)
      if (!Array.isArray(phaseCreated) || (Array.isArray(phaseCreated) && phaseCreated.length <= 0)) {
        return res.status(400).send({ errors: 'Erro ao criar a fase!' })
      }

      // Realiza uma verificação com o id do departamento e depois gera a ligação com a fase.
      await this._departmentPhaseLinked(req.body.department, req.headers.authorization, obj.id)

      // Registra a configuração de SLA da fase.
      if (req.body.sla) {
        await this._phaseSLASettings(req.body.sla, obj.id)
      }

      // Formata o obj de retorno.
      delete obj.id_company

      let column = []
      if (req.body.column) {
        req.body.column.map(item => {
          column.push({
            type: item.type,
            label: item.label,
            column: item.column,
            required: item.required,
            editable: item.editable,
            visible_on_card_ticket: item.visible_on_card_ticket,
          })
        })
      }
      obj.column = column
      // obj.created_at = moment(obj.created_at).format('DD/MM/YYYY HH:mm:ss')
      // obj.updated_at = moment(obj.updated_at).format('DD/MM/YYYY HH:mm:ss')

      obj = await this._formatPhase(obj, req.app.locals.db, false, false, req.headers.authorization)

      await this.redis.del(`ticket:phase:${req.headers.authorization}`)
      await CallbackDigitalk(
        {
          type: 'socket',
          channel: `wf_department_${req.body.department}`,
          event: 'new_phase',
          obj
        },
        req.company[0].callback
      )

      await cache(req.headers.authorization, req.body.department, obj.id, this)

      return res.status(200).send(obj)
    } catch (err) {
      this.logger.error(err, 'Error when manage phase create.')
      return res.status(400).send({ error: 'Error when manage phase create' })
    }
  }

  async _departmentPhaseLinked(department, authorization, phaseId) {
    const result = await this.departmentController.checkDepartmentCreated(department, authorization)
    await this.phaseModel.linkedDepartment({
      id_department: result[0].id,
      id_phase: phaseId,
      active: true
    })
  }

  async _formPhase(column) {
    const errorsColumns = await templateValidate(column, this.database, this.logger)
    if (errorsColumns.length > 0) return { 'error': errorsColumns }

    const formTemplate = await this.formTemplate.createRegister(column)

    if (!formTemplate) return false

    for (const formatcolumn of column) {
      this.logger.info({ msg: 'Chamada ao get type by id ', data: formatcolumn.type })

      if (formatcolumn.type) {
        const type = await this.typeColumnModel.getTypeByID(formatcolumn.type)
        formatcolumn.type = type[0]?.name
      }
    }

    return formTemplate
  }

  async _phaseSLASettings(obj, idPhase) {
    const keys = Object.keys(obj)

    const slaSettings = async function (sla, type, slaModel) {
      console.log('sla ===> ', sla)
      if (sla.unit_of_time && sla.time) {
        await slaModel.slaPhaseSettings({
          id_phase: idPhase,
          id_sla_type: type,
          id_unit_of_time: sla.unit_of_time,
          time: sla.time,
          active: sla.active
        })
      }
      return true
    }

    keys.map((key) => {
      switch (key) {
        case '1':
          slaSettings(obj[key], key, this.slaModel)
          break
        case '2':
          slaSettings(obj[key], key, this.slaModel)
          break
        case '3':
          slaSettings(obj[key], key, this.slaModel)
          break
        default:
          return false
      }
    })
  }

  async getPhaseByID(req, res) {
    try {
      const result = await this.phaseModel.getPhaseById(req.params.id, req.headers.authorization)
      if (!result || result.length < 0) return res.status(400).send({ error: 'Invalid id phase' })

      const departments = await this.phaseModel.getDepartmentPhase(result[0].id)
      result[0].department = departments[0].id_department

      result[0] = await this._formatPhase(result[0], req.app.locals.db, false, false, req.headers.authorization)
      return res.status(200).send(result)
    } catch (err) {
      this.logger.error(err, `Error get phases with ID ${req.params.id}`)
      return res.status(400).send({ error: 'There was an error' })
    }
  }

  async getAllPhase(req, res) {
    const search = req.query.search ? req.query.search : ''
    let result
    try {
      if (search) {
        result = await this.phaseModel.getAllPhasesByDepartmentID(req.query.department, req.headers.authorization, req.query.enable)
        req.query.offset = Math.round(req.query.limit * (req.query.offset - 1))
        for (let i in result) {
          result[i].ticket = { 1: {}, 2: {}, 3: {} }
          typeof req.query.status === 'string' ? (req.query.status = JSON.parse(req.query.status)) : ''
          for await (const status of req.query.status) {
            if (!req.query.me || req.query.me === "false") {
              result[i].ticket[status] = await this.ticketModel.searchTicket(
                req.headers.authorization,
                search,
                result[i].id,
                status,
                req.query.limit,
                req.query.offset
              )
            } else {
              result[i].ticket[status] = await this.ticketModel.searchTicketWithMe(
                req.headers.authorization,
                search,
                result[i].id,
                status,
                req.query.limit,
                req.query.offset,
                req.query.me
              )
            }


            for (const x in result[i].ticket[status].tickets) {
              //console.log(result[i].ticket[status].tickets[x])
              result[i].ticket[status].tickets[x] = await this.formatTicket.formatTicketForPhase(
                result[i],
                result[i].ticket[status].tickets[x]
              )
            }
          }

          result[i] = await this._formatPhase(result[i], req.app.locals.db, true, false, req.headers.authorization, 0, 1, undefined)
        }
      } else if (req.query.department) {
        result = await this._queryDepartment(
          req.query.department,
          req.headers.authorization,
          req.query.status,
          req.app.locals.db,
          req.query.enable,
          req.query.limit,
          req.query.offset
        )
      } else {
        result = await this.phaseModel.getAllPhase(req.headers.authorization, req.query.enable)

        for (let i in result) {
          result[i] = await this._formatPhase(
            result[i],
            req.app.locals.db,
            false,
            false,
            req.headers.authorization,
            req.query.limit,
            req.query.offset,
            req.query.me
          )
        }
      }

      result.map(phase => {
        let tickets = Object.values(phase.ticket)
        if (!tickets) return false
        tickets.map((ticket) => {
          if (ticket.tickets) {
            ticket.tickets.filter((item) => {
              if (item.form_data?._id) delete item.form_data._id
              if (item.id_form_template) delete item.id_form_template
            })
          }
        })
      })

      return res.status(200).send(result)
    } catch (err) {
      this.logger.error(err, 'Get all phase => ')
      return res.status(400).send({ error: 'There was an error' })
    }
  }

  async getBySocket(req, res) {
    try {
      let result = await this.phaseModel.getAllPhasesByDepartmentID(req.params.id, req.headers.authorization)
      for (let phase of result) {
        phase = await this._formatPhase(phase, req.app.locals.db, false, false, req.headers.authorization, 20, 0, undefined)
      }
      return res.status(200).send(result)
    } catch (err) {
      this.logger.error(err, `Error get by socket with department ID ${req.params.id}`)
      return res.status(400).send({ error: 'There was an error' })
    }
  }
  // departments = JSON.parse(departments)
  async _queryDepartment(department, authorization, status, db, enable, limit, offset) {
    let result = await this.phaseModel.getAllPhasesByDepartmentID(department, authorization, enable)
    for (let phase of result) {
      phase = await this._formatPhase(phase, db, false, status, authorization, limit, offset, undefined)
    }
    return result
  }

  async updatePhase(req, res) {
    // const errors = validationResult(req)
    // if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })
    try {
      let obj = {
        icon: req.body.icon,
        name: req.body.name,
        responsible_notify_sla: req.body.notify_responsible,
        supervisor_notify_sla: req.body.notify_supervisor,
        updated_at: moment().format(),
        active: req.body.active,
        visible_new_ticket: req.body.visible_new_ticket,
        notification_customer: req.body.customer,
        notification_admin: req.body.admin,
        notification_responsible: req.body.responsible,
        notification_separate: { separate: req.body.separate },
        department_can_create_protocol: {
          department: req.body.department_can_create_protocol
        },
        department_can_create_ticket: {
          department: req.body.department_can_create_ticket
        },
        create_protocol: req.body.create_protocol,
        create_ticket: req.body.create_ticket,
        form: req.body.form
      }

      // Valida se a fase existe na company e se está ativa no departamento
      const oldPhase = await this.phaseModel.getPhaseById(req.params.id, req.headers.authorization)

      if (!oldPhase || oldPhase.length <= 0) return res.status(400).send({ error: 'Error when manage phase update' })

      await this._departmentPhaseLinked(req.body.department, req.headers.authorization, req.params.id)
        ;['responsible', 'notify'].map(async (x) => {
          const usersNotify = []
          if (req.body[x] && Array.isArray(req.body[x]) && req.body[x].length > 0) {
            for await (const notified of req.body[x]) {
              let resultUser
              resultUser = await this.userController.checkUserCreated(
                notified,
                req.headers.authorization,
                notified.name,
                notified.phone,
                notified.email,
                1
              )
              usersNotify.push(resultUser.id)
            }
            x === 'responsible'
              ? await this._responsiblePhase(req.params.id, usersNotify)
              : await this._notifyPhase(req.params.id, usersNotify)
          }
        })

      // Registra a configuração de SLA da fase.
      req.body.sla && (await this._phaseSLASettings(req.body.sla, req.params.id))

      let phase = await this.phaseModel.getPhaseById(req.params.id, req.headers.authorization)

      if (req.body.form && req.body.column) {
        if (phase[0].id_form_template) {
          let validations = await this._checkColumnsFormTemplate(req.body.column, phase[0].id_form_template)
          console.log('validations',validations)
          if (validations?.errors?.length > 0) return res.status(400).send({ error: validations })

          let column = []
          validations?.newTemplate.map(item => {
            column.push({
              type: item.type,
              label: item.label,
              column: item.column,
              required: item.required,
              editable: item.editable,
              visible_on_card_ticket: item.visible_on_card_ticket,
              active: typeof item.active === 'boolean' ? item.active: true 
            })
          })

          validations.register.column = column
          await this.formTemplate.updateRegister(validations.register._id, validations.register)
          phase[0].department = req.body.department
          phase[0].formTemplate = column
          delete phase[0].id_form_template
        } else {
          const templateValidate = await this._formPhase(req.body.column)
          if (!templateValidate) {
            return res.status(400).send({ errors: templateValidate })
          }
          // Esse update é para caso a fase não tivesse formulario anteriormente e foi decidido adicionar
          obj.id_form_template = templateValidate

          this.logger.info('Return of validate template', templateValidate)
        }
      }

      await this.phaseModel.updatePhase(obj, req.params.id, req.headers.authorization)

      if (obj.active != oldPhase[0].active) {
        await CallbackDigitalk(
          {
            type: 'socket',
            channel: `wf_department_${req.body.department}`,
            event: 'change_active_phase',
            obj: { id: req.params.id, active: obj.active }
          },
          req.company[0].callback
        )
      }

      await cache(req.headers.authorization, req.body.department, req.params.id, this)

      await this.redis.del(`ticket:phase:${req.headers.authorization}`)
      return res.status(200).send(phase)
    } catch (err) {
      this.logger.error(err, 'Error when manage phase update.')
      return res.status(400).send({ error: 'Error when manage phase update' })
    }
  }

  async _responsiblePhase(phase_id, usersResponsible) {
    try {
      await this.phaseModel.delResponsiblePhase(phase_id)

      if (usersResponsible.length > 0) {
        usersResponsible.map(async (user) => {
          await this.phaseModel.createResponsiblePhase({
            id_phase: phase_id,
            id_user: user,
            id_type_of_responsible: 1
          })
        })
      }
    } catch (err) {
      this.logger.error(err, 'Error create responsible phase.')
      return err
    }
  }

  async _notifyPhase(phase_id, usersNotify) {
    try {
      await this.phaseModel.delNotifyPhase(phase_id)

      if (usersNotify.length > 0) {
        usersNotify.map(async (user) => {
          await this.phaseModel.createNotifyPhase({
            id_phase: phase_id,
            id_user: user
          })
        })
      }
    } catch (err) {
      this.logger.error(err, 'Error create notify phase.')
      return err
    }
  }

  async _checkColumnsFormTemplate(newTemplate, template) {
    const register = await this.formTemplate.findRegister(template)
    const errors = []
    
    const activeRegister = register.column.filter(item => (item === true))
    if (newTemplate.length < activeRegister) errors.push('Não é possivel remover campos do formulario, apenas inativa-los')

    const errorsColumns = await templateValidate(newTemplate, this.database, this.logger)

    if (errorsColumns.length > 0) errorsColumns.map(error => errors.push(error))

    register.column.map((valueA) => {
      console.log('===>',valueA)

      let validate = 0
      let inativado = 0
      if(valueA.active === false) {
        newTemplate = [...newTemplate, valueA] 
      }
      newTemplate.map((valueB) => (valueA.column == valueB.column ? (valueB.column.active ? validate++ : validate++ && inativado++) : ''))

      if (validate <= 0)
        errors.push(`A coluna ${valueA.label} não pode ser removido ou o valor do campo column não pode ser alterado, apenas inativado`)

      if (validate > 1 && inativado <= 0) errors.push(`A coluna ${valueA.label} não pode ser igual a um ja criado`)
    })

    if (errors.length > 0) return {errors: errors}

    return {newTemplate:newTemplate, register:register }
  }

  async _formatPhase(result, mongodb, search = false, status, authorization, limit = 0, offset = 1, me) {
    status = JSON.parse(status)

    result.header = {}
    result.sla = await this.slaController.settingsSLA(result.id)
    if (result.id_form_template) {
      const register = await this.formTemplate.findRegister(result.id_form_template)

      if (register && register.column) {
        result.formTemplate = register.column
        for await (const x of result.formTemplate) {
          !isNaN(x.type) && x.type != 0 && (x.type = (await this.typeColumnModel.getTypeByID(x.type))[0].name)
        }
        result.formTemplate = result.formTemplate.filter(column => (typeof column.active === 'boolean' && column.active) || typeof column.active !== 'boolean')

      }
    }

    if (!search) {
      result.ticket = []
      offset = Math.round(limit * (offset - 1))

      const tickets = {
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

      if (status && Array.isArray(status)) {
        for await (let x of status) {
          x = x.toString()

          if (!me || me == "false") {
            tickets[x].tickets = await this.ticketModel.getTicketByPhasePaged(result.id, x, limit, offset)
            tickets[x].total = await this.ticketModel.countTicket(result.id, x, false)
          } else {
            tickets[x].tickets = await this.ticketModel.getTicketByPhasePagedWithMe(result.id, x, limit, offset, me)
            tickets[x].total = await this.ticketModel.countTicketWithMe(result.id, x, me)
          }


          if (tickets[x].tickets) {
            for await (let ticket of tickets[x].tickets) {
              ticket = await this.formatTicket.formatTicketForPhase(result, ticket)
            }
          }
        }
      }

      result.ticket = tickets
    }

    result.department_can_create_protocol && result.department_can_create_protocol.department
      ? (result.department_can_create_protocol = result.department_can_create_protocol.department)
      : (result.department_can_create_protocol = [])

    result.department_can_create_ticket && result.department_can_create_ticket.department
      ? (result.department_can_create_ticket = result.department_can_create_ticket.department)
      : (result.department_can_create_ticket = [])

    result.separate && result.separate.separate ? (result.separate = result.separate.separate) : (result.separate = null)

    result.header = await this.headerGenerate({ id: result.id, authorization })

    delete result.id_form_template

    return result
  }

  async getAllPhaseForCache(req, res) {
    try {
      const result = await this._getByDepartment(req.query.departments, req.headers.authorization, req.app.locals.db)

      return res.status(200).send(result)
    } catch (err) {
      return res.status(400).send({ error: 'There was an error' })
    }
  }

  async _getByDepartment(departments, authorization, db) {
    try {
      let phases = []
      // departments = JSON.parse(departments);
      if (departments.length > 0 && Array.isArray(departments)) {
        for await (const department of departments) {
          phases = phases.concat(await this._phaseForCache(department, authorization))
        }
        return phases
      } else {
        return await this._phaseForCache(departments, authorization)
      }
    } catch (err) {
      this.logger.error(err)
      return { error: 'Houve algum erro ao captar o departamento pelo id' }
    }
  }

  async _phaseForCache(departments, authorization) {
    try {
      const phases = []
      const department_id = await this.departmentModel.getByID(departments, authorization)
      if (department_id && department_id.length <= 0) return false

      const result = await this.phaseModel.getPhasesByDepartmentID(department_id[0].id)
      for (const phase of result) {
        if (phase.id_form_template && phase.form) {
          const register = await this.formTemplate.findRegister(phase.id_form_template)

          for await (const x of register.column) {
            if (!isNaN(x.type) && x.type != 0) x.type = (await this.typeColumnModel.getTypeByID(x.type))[0].name
          }
          phase.formTemplate = register.column

          delete phase.id_form_template
        }
        phase.department = departments

        phases.push(phase)
      }

      return phases
    } catch (err) {
      console.log(err)
    }
  }

  async disablePhase(req, res) {
    try {
      const result = await this.phaseModel.getPhaseById(req.params.id, req.headers.authorization)
      if (!result || result.length < 0) return res.status(400).send({ error: 'Invalid id phase' })

      const departments = await this.phaseModel.getDepartmentPhase(result[0].id)
      result[0].department = departments[0].id_department

      result[0].ticket = []
      result[0].header = {}

      result[0].sla = await this.slaController.settingsSLA(result[0].id)
      await this.phaseModel.updatePhase({ active: req.body.active }, req.params.id, req.headers.authorization)
      await cache(req.headers.authorization, result[0].department, req.params.id, this)

      await CallbackDigitalk(
        {
          type: 'socket',
          channel: `wf_department_${result[0].department}`,
          event: 'disable_phase',
          obj: { id: req.params.id, active: req.body.active }
        },
        req.company[0].callback
      )

      return res.status(200).send({ status: 'ok' })
    } catch (err) {
      this.logger.error(err)
      return res.status(400).send({ error: 'Error when disable phase' })
    }
  }

  async closeMassive(req, res) {
    try {
      const phase = await this.phaseModel.getPhaseById(req.params.id, req.headers.authorization)
      if (phase.length <= 0) return res.status(400).send({ error: 'Id da phase invalido' })

      //Verifica se o id do usuario está sendo passado no body da requisição.
      if (!req.body.id_user) {
        return res.status(400).send({ error: 'Whitout id_user' })
      }

      //Faz a verificação de usuario, caso ele não exista ele cria na base.
      let user = await this.userController.checkUserCreated(req.body.id_user, req.headers.authorization, req.body.name_user)

      //Verifica se ocorreu algum erro na checagem de usuario.
      if (!user || !user.id) {
        this.logger.info('Ocorreu algum erro na checagem do usuario')
        return res.status(400).send({ error: 'Ocorreu algum erro na checagem de usuario' })
      }

      //Faz o get dos tickets pelo id da fase.
      const tickets = await this.ticketModel.getTicketByPhase(req.params.id)

      //Retorna um erro caso a fase não contenha tickets na fase.
      if (tickets.length <= 0) {
        this.logger.info('Não há tickets ativos')
        return res.status(400).send({ error: 'Não há tickets ativos nessa phase' })
      }

      //Faz um laço de repetição finalizando todos os tickets relacionados a phase.

      for (let ticket of tickets) {
        if (!ticket.closed) {
          ticket = await this.ticketModel.getTicketById(ticket.id, req.headers.authorization)
          await this.ticketModel.closedTicket(ticket[0].id)

          await this.slaController.updateSLA(ticket[0].id, req.params.id, 3)

          await this.slaModel.disableSLA(ticket[0].id)

       }
      }

      await cache(req.headers.authorization, phase[0].id_department, req.params.id, this)

      return res.status(200).send({ msg: 'OK' })
    } catch (err) {
      this.logger.error(err, 'Error when close massive tickets.')
      return res.status(500).send({ error: 'Houve um erro ao finalizar os tickets' })
    }
  }

  async orderPhase(req, res) {
    try {
      if (!req.params.id) return res.status(400).send({ error: 'É obrigatorio a informação do departamento' })

      if (!Array.isArray(req.body) && req.body.length <= 0) return res.status(400).send({ error: 'O array deve conter os ids das fases' })

      const check = await this.phaseModel.getPhasesIN(req.body, req.params.id, req.headers.authorization)

      if (!Array.isArray(check) || (Array.isArray(check) && req.body.length != check.length))
        return res.status(400).send({ error: 'Houve um erro ordenar as fases do workflow' })

      req.body.map(async (value, index) => {
        const obj = { order: index }
        await this.phaseModel.updatePhase(obj, value, req.headers.authorization)
        return true
      })

      await CallbackDigitalk(
        {
          type: 'socket',
          channel: `wf_department_${req.params.id}`,
          event: 'new_order_phase',
          obj: req.body
        },
        req.company[0].callback
      )

      return res.status(200).send(req.body)
    } catch (err) {
      this.logger.info(err, 'Erro ao ordenar as fases.')
      return res.status(500).send({ error: 'Houve um erro ordenar as fases do workflow' })
    }
  }

  async dash(req, res) {
    try {
      if (req.query.customer) {
        const dashRedis = await this.redis.get(`msTicket:dashForCustomer:${req.headers.authorization}:department:${req.params.id}`)
        const dash = JSON.parse(dashRedis)

        if (dash) return res.status(200).send(dash)

        const result = await this.dashGenerateWithCustomer({
          id: req.params.id,
          authorization: req.headers.authorization,
          customer: req.query.customer
        })

        return res.status(200).send(result)
      } else {
        const result = await this.dashController.dashGenerateV2({
          id: req.params.id,
          authorization: req.headers.authorization
        })

        return res.status(200).send(result)
      }
    } catch (err) {
      this.logger.error(err, 'Error when generate dash')
      return res.status(500).send({ error: 'Houve algum problema!' })
    }
  }

  async filter(req, res) {
    try {
      if (!req.query.department) return res.status(500).send({ error: 'Houve um erro' })

      const tickets = await this.phaseModel.filter(req.query.department, req.headers.authorization, req.query.customer)
      let obj = []
      if (req.query.type) {
        switch (req.query.type) {
          case 'tickets_nao_iniciados':
            for await (const ticket of tickets) {
              const phaseSettings = await this.slaModel.getSLASettings(ticket.id_phase)
              if (phaseSettings && phaseSettings.length > 0) {
                const sla_ticket = await this.slaModel.getForDash(ticket.id_phase, ticket.id)
                for await (const sla of sla_ticket) {
                  if (sla.id_sla_type === 1) {
                    if (sla.active) {
                      if (sla.id_sla_status == 1) {
                        if (req.query.sla === 'emdia' || req.query.sla === 'undefined') obj.push(ticket)
                      } else if (sla.id_sla_status == 2) {
                        if (req.query.sla === 'atrasado' || req.query.sla === 'undefined') obj.push(ticket)
                      }
                    }
                  }
                }
              } else {
                if (ticket.id_status === 1) {
                  if (req.query.sla === 'sem_sla' || req.query.sla === 'undefined') obj.push(ticket)
                }
              }
            }
            break
          case 'tickets_iniciados_sem_resposta':
            for await (const ticket of tickets) {
              const phaseSettings = await this.slaModel.getSLASettings(ticket.id_phase)
              if (phaseSettings && phaseSettings.length > 0) {
                const sla_ticket = await this.slaModel.getForDash(ticket.id_phase, ticket.id)
                for await (const sla of sla_ticket) {
                  switch (sla.id_sla_type) {
                    case 1:
                      if (!sla.active) {
                        const nextSLA = sla_ticket.filter((x) => x.id_sla_type === 2 || x.id_sla_type === 3)
                        if (nextSLA.length <= 0) {
                          if (ticket.id_status === 2) {
                            const firstInteraction = await this.ticketModel.first_interaction(ticket.id)
                            if (firstInteraction && firstInteraction.length <= 0) {
                              if (req.query.sla === 'sem_sla' || req.query.sla === 'undefined') obj.push(ticket)
                            }
                          }
                        }
                      }
                      break
                    case 2:
                      if (!sla.interaction_time) {
                        if (sla.id_sla_status === 1) {
                          if (req.query.sla === 'emdia' || req.query.sla === 'undefined') obj.push(ticket)
                        } else {
                          if (req.query.sla === 'atrasado' || req.query.sla === 'undefined') obj.push(ticket)
                        }
                      }
                  }
                }
              } else {
                if (ticket.id_status === 2) {
                  const firstInteraction = await this.ticketModel.first_interaction(ticket.id)
                  if (firstInteraction && firstInteraction.length <= 0) {
                    if (req.query.sla === 'sem_sla' || req.query.sla === 'undefined') obj.push(ticket)
                  }
                }
              }
            }
            break
          case 'tickets_respondidos_sem_conclusao':
            for await (const ticket of tickets) {
              const phaseSettings = await this.slaModel.getSLASettings(ticket.id_phase)
              if (phaseSettings && phaseSettings.length > 0) {
                const sla_ticket = await this.slaModel.getForDash(ticket.id_phase, ticket.id)
                for await (const sla of sla_ticket) {
                  switch (sla.id_sla_type) {
                    case 1:
                      if (!sla.active) {
                        const nextSLA = sla_ticket.filter((x) => x.id_sla_type === 2 || x.id_sla_type === 3)
                        if (nextSLA.length <= 0) {
                          if (ticket.id_status === 2) {
                            const firstInteraction = await this.ticketModel.first_interaction(ticket.id)
                            if (firstInteraction && firstInteraction.length > 0) {
                              if (req.query.sla === 'sem_sla' || req.query.sla === 'undefined') obj.push(ticket)
                            }
                          }
                        }
                      }
                    case 2:
                      if (sla.interaction_time) {
                        const nextSLA = sla_ticket.filter((x) => x.id_sla_type === 3 && x.active)

                        if (nextSLA.length > 0) {
                          if (nextSLA[0].id_sla_status === 2) {
                            if (req.query.sla === 'atrasado' || req.query.sla === 'undefined') obj.push(ticket)
                          } else {
                            if (req.query.sla === 'emdia' || req.query.sla === 'undefined') obj.push(ticket)
                          }
                        }
                      }
                  }
                }
              } else {
                if (ticket.id_status === 2) {
                  const firstInteraction = await this.ticketModel.first_interaction(ticket.id)
                  if (firstInteraction && firstInteraction.length > 0) {
                    if (req.query.sla === 'sem_sla' || req.query.sla === 'undefined') obj.push(ticket)
                  }
                }
              }
            }
            break
          case 'tickets_concluidos':
            for await (const ticket of tickets) {
              const phaseSettings = await this.slaModel.getSLASettings(ticket.id_phase)
              if (phaseSettings && phaseSettings.length > 0) {
                const sla_ticket = await this.slaModel.getForDash(ticket.id_phase, ticket.id)
                if (sla_ticket.length > 0) {
                  for await (const sla of sla_ticket) {
                    if (sla.id_sla_type === 1) {
                      if (!sla.active) {
                        const nextSLA = sla_ticket.filter((x) => x.id_sla_type === 2 || x.id_sla_type === 3)

                        if (nextSLA.length <= 0) {
                          if (ticket.id_status === 3) {
                            if (req.query.sla === 'sem_sla' || req.query.sla === 'undefined') obj.push(ticket)
                          }
                        }
                      } else if (sla.id_sla_type === 3) {
                        if (!sla.active) {
                          const nextSLA = sla_ticket.filter((x) => x.id_sla_type === 2 && x.interaction_time)
                          if (nextSLA.length > 0) {
                            if (sla.id_sla_status === 1) {
                              if (req.query.sla === 'emdia' || req.query.sla === 'undefined') obj.push(ticket)
                            } else if (sla.id_sla_status === 2) {
                              if (req.query.sla === 'atrasado' || req.query.sla === 'undefined') obj.push(ticket)
                            }
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (ticket.id_status === 3) {
                    if (req.query.sla === 'sem_sla' || req.query.sla === 'undefined') obj.push(ticket)
                  }
                }
              } else {
                if (ticket.id_status === 3) {
                  if (req.query.sla === 'sem_sla' || req.query.sla === 'undefined') obj.push(ticket)
                }
              }
            }
            break
          default:
            break
        }
      } else {
        obj = tickets
      }

      for (let i in obj) {
        obj[i] = await this.ticketModel.getTicketById(obj[i].id, req.headers.authorization)
        obj[i] = await this.formatTicket.formatTicketForPhase({ id: obj[i][0].phase_id, sla: false }, obj[i])
      }
      return res.status(200).send(obj)
    } catch (err) {
      this.logger.error(err, 'Erro ao filtrar os dados')
      return res.status(500).send({ error: 'Houve um erro' })
    }
  }


  async dashGenerateWithCustomer(data) {
    if (!data.id) return false

    this.logger.info('DASH GENERATE WITH CUSTOMER')
    const result = await this.phaseModel.dashForCustomer(data.id, data.authorization, data.customer)
    result.total_tickets_nao_iniciados = 0
    result.tickets_nao_iniciados = {
      emdia: 0,
      atrasado: 0,
      sem_sla: 0
    }
    result.total_tickets_iniciados_sem_resposta = 0
    result.tickets_iniciados_sem_resposta = {
      emdia: 0,
      atrasado: 0,
      sem_sla: 0
    }

    result.total_tickets_respondidos_sem_conclusao = 0
    result.tickets_respondidos_sem_conclusao = {
      emdia: 0,
      atrasado: 0,
      sem_sla: 0
    }

    result.tickets_concluidos = {
      emdia: 0,
      atrasado: 0,
      sem_sla: 0
    }

    let n_iniciado = 0
    let iniciados = 0
    let concluidos = 0

    for await (const ticket of result.tickets) {
      if (ticket.id_status === 2) {
        iniciados = iniciados + 1
      }
      if (ticket.id_status === 3) {
        concluidos = concluidos + 1
      }

      const phaseSettings = await this.slaModel.getSLASettings(ticket.id_phase)

      if (phaseSettings && phaseSettings.length > 0) {
        const sla_ticket = await this.slaModel.getForDash(ticket.id_phase, ticket.id)
        if (ticket.id_status === 1) {
          n_iniciado = n_iniciado + 1
        }
        if (sla_ticket && sla_ticket.length > 0) {
          for await (const sla of sla_ticket) {
            switch (sla.id_sla_type) {
              case 1:
                if (sla.active) {
                  result.total_tickets_nao_iniciados = result.total_tickets_nao_iniciados + 1
                  if (sla.id_sla_status == 1) {
                    result.tickets_nao_iniciados.emdia = result.tickets_nao_iniciados.emdia + 1
                  } else if (sla.id_sla_status == 2) {
                    result.tickets_nao_iniciados.atrasado = result.tickets_nao_iniciados.atrasado + 1
                  }
                } else {
                  const nextSLA = sla_ticket.filter((x) => x.id_sla_type === 2 || x.id_sla_type === 3)

                  if (nextSLA.length <= 0) {
                    switch (ticket.id_status) {
                      case 2:
                        const firstInteraction = await this.ticketModel.first_interaction(ticket.id)
                        if (firstInteraction && firstInteraction.length <= 0) {
                          result.total_tickets_iniciados_sem_resposta = result.total_tickets_iniciados_sem_resposta + 1
                          result.tickets_iniciados_sem_resposta.sem_sla = result.tickets_iniciados_sem_resposta.sem_sla + 1
                        } else {
                          result.total_tickets_respondidos_sem_conclusao = result.total_tickets_respondidos_sem_conclusao + 1
                          result.tickets_respondidos_sem_conclusao.sem_sla = result.tickets_respondidos_sem_conclusao.sem_sla + 1
                        }

                        break
                      case 3:
                        result.tickets_concluidos.sem_sla = result.tickets_concluidos.sem_sla + 1
                        break
                      default:
                        break
                    }
                  }
                }
                break
              case 2:
                if (!sla.interaction_time) {
                  result.total_tickets_iniciados_sem_resposta = result.total_tickets_iniciados_sem_resposta + 1
                  if (sla.id_sla_status === 1) {
                    result.tickets_iniciados_sem_resposta.emdia = result.tickets_iniciados_sem_resposta.emdia + 1
                  } else {
                    result.tickets_iniciados_sem_resposta.atrasado = result.tickets_iniciados_sem_resposta.atrasado + 1
                  }
                } else {
                  const nextSLA = sla_ticket.filter((x) => x.id_sla_type === 3 && x.active)
                  nextSLA
                  if (nextSLA.length > 0) {
                    result.total_tickets_respondidos_sem_conclusao = result.total_tickets_respondidos_sem_conclusao + 1
                    if (nextSLA[0].id_sla_status === 2) {
                      result.tickets_respondidos_sem_conclusao.atrasado = result.tickets_respondidos_sem_conclusao.atrasado + 1
                    } else {
                      result.tickets_respondidos_sem_conclusao.emdia = result.tickets_respondidos_sem_conclusao.emdia + 1
                    }
                  }
                }
                break
              case 3:
                if (!sla.active) {
                  const nextSLA = sla_ticket.filter((x) => x.id_sla_type === 2 && x.interaction_time)
                  if (nextSLA.length > 0) {
                    if (sla.id_sla_status === 1) {
                      result.tickets_concluidos.emdia = result.tickets_concluidos.emdia + 1
                    } else if (sla.id_sla_status === 2) {
                      result.tickets_concluidos.atrasado = result.tickets_concluidos.atrasado + 1
                    }
                  }
                }
                break

              default:
                break
            }
          }
        } else {
          switch (ticket.id_status) {
            case 1:
              result.total_tickets_nao_iniciados = result.total_tickets_nao_iniciados + 1
              result.tickets_nao_iniciados.sem_sla = result.tickets_nao_iniciados.sem_sla + 1
              break
            case 2:
              const firstInteraction = await this.ticketModel.first_interaction(ticket.id)
              if (firstInteraction && firstInteraction.length <= 0) {
                result.total_tickets_iniciados_sem_resposta = result.total_tickets_iniciados_sem_resposta + 1

                result.tickets_iniciados_sem_resposta.sem_sla = result.tickets_iniciados_sem_resposta.sem_sla + 1
              } else {
                result.total_tickets_respondidos_sem_conclusao = result.total_tickets_respondidos_sem_conclusao + 1

                result.tickets_respondidos_sem_conclusao.sem_sla = result.tickets_respondidos_sem_conclusao.sem_sla + 1
              }

              break
            case 3:
              result.tickets_concluidos.sem_sla = result.tickets_concluidos.sem_sla + 1
              break
            default:
              break
          }
        }
      } else {
        switch (ticket.id_status) {
          case 1:
            result.total_tickets_nao_iniciados = result.total_tickets_nao_iniciados + 1
            result.tickets_nao_iniciados.sem_sla = result.tickets_nao_iniciados.sem_sla + 1
            break
          case 2:
            const firstInteraction = await this.ticketModel.first_interaction(ticket.id)
            if (firstInteraction && firstInteraction.length <= 0) {
              result.total_tickets_iniciados_sem_resposta = result.total_tickets_iniciados_sem_resposta + 1

              result.tickets_iniciados_sem_resposta.sem_sla = result.tickets_iniciados_sem_resposta.sem_sla + 1
            } else {
              result.total_tickets_respondidos_sem_conclusao = result.total_tickets_respondidos_sem_conclusao + 1

              result.tickets_respondidos_sem_conclusao.sem_sla = result.tickets_respondidos_sem_conclusao.sem_sla + 1
            }

            break
          case 3:
            result.tickets_concluidos.sem_sla = result.tickets_concluidos.sem_sla + 1
            break
          default:
            break
        }
      }
    }

    const calc_percentual = async function (total, value) {
      if (total == 0) return 0

      return ((parseInt(value) * 100) / parseInt(total)).toFixed(2)
    }
    result.percentual_nao_iniciado = {
      total: await calc_percentual(result.total_tickets, result.total_tickets_nao_iniciados),
      emdia: await calc_percentual(result.total_tickets_nao_iniciados, result.tickets_nao_iniciados.emdia),
      atrasado: await calc_percentual(result.total_tickets_nao_iniciados, result.tickets_nao_iniciados.atrasado),
      sem_sla: await calc_percentual(result.total_tickets_nao_iniciados, result.tickets_nao_iniciados.sem_sla)
    }
    result.percentual_iniciado_sem_resposta = {
      total: await calc_percentual(result.total_tickets, result.total_tickets_iniciados_sem_resposta),
      emdia: await calc_percentual(result.total_tickets_iniciados_sem_resposta, result.tickets_iniciados_sem_resposta.emdia),
      atrasado: await calc_percentual(result.total_tickets_iniciados_sem_resposta, result.tickets_iniciados_sem_resposta.atrasado),
      sem_sla: await calc_percentual(result.total_tickets_iniciados_sem_resposta, result.tickets_iniciados_sem_resposta.sem_sla)
    }
    result.percentual_respondido_sem_conclusao = {
      total: await calc_percentual(result.total_tickets, result.total_tickets_respondidos_sem_conclusao),
      emdia: await calc_percentual(result.total_tickets_respondidos_sem_conclusao, result.tickets_respondidos_sem_conclusao.emdia),
      atrasado: await calc_percentual(result.total_tickets_respondidos_sem_conclusao, result.tickets_respondidos_sem_conclusao.atrasado),
      sem_sla: await calc_percentual(result.total_tickets_respondidos_sem_conclusao, result.tickets_respondidos_sem_conclusao.sem_sla)
    }
    result.percentual_concluido = {
      total: await calc_percentual(result.total_tickets, result.total_tickets_fechados),
      emdia: await calc_percentual(result.total_tickets_fechados, result.tickets_concluidos.emdia),
      atrasado: await calc_percentual(result.total_tickets_fechados, result.tickets_concluidos.atrasado),
      sem_sla: await calc_percentual(result.total_tickets_fechados, result.tickets_concluidos.sem_sla)
    }

    delete result.tickets
    delete result.phases

    await this.redis.set(`msTicket:dashForCustomer:${data.authorization}:department:${data.id}`, JSON.stringify(result))
    return result
  }

  async headerGenerate(data) {
    const result = await this.phaseModel.getFormularios(data.id, data.customer)
    let campos_calculados = {}
    if (result.id_form && result.id_form.length > 0) {
      const register = await this.formTemplate.findRegister(result.id_form[0].id_form_template)

      if (register && register.column) {
        const campos_calculaveis = register.column.filter((x) => x.calculable)
        if (campos_calculaveis.length > 0) {
          for await (const forms of result.forms) {
            const documents = await this.formDocuments.findRegister(forms.id_form)

            if (documents) {
              for (const campo of campos_calculaveis) {
                if (!campos_calculados[campo.column]) campos_calculados[campo.column] = 0

                console.log('docks', documents[campo.column])
                !isNaN(documents[campo.column])
                  ? typeof documents[campo.column] === 'string'
                    ? (campos_calculados[campo.column] = campos_calculados[campo.column] + parseFloat(documents[campo.column]))
                    : (campos_calculados[campo.column] = campos_calculados[campo.column] + documents[campo.column])
                  : ''
              }
            }
          }
        }
      }
    }
    const header = await this.#formatHeader({ campos_calculados: campos_calculados }, data)

    return header
  }

  async #formatHeader(header, ticketInfo) {
    header.total_tickets = await this.ticketModel.countAllTicket(ticketInfo.id, ticketInfo.customer)
    header.counter_sla = await this.slaController.counter_sla(ticketInfo.id, false, ticketInfo.customer)
    header.counter_sla_closed = await this.slaController.counter_sla(ticketInfo.id, true, ticketInfo.customer)
    header.closed_tickets = parseInt(await this.ticketModel.countTicket(ticketInfo.id, 3, ticketInfo.customer))
    header.open_tickets =
      parseInt(await this.ticketModel.countTicket(ticketInfo.id, 1, ticketInfo.customer))
      + parseInt(await this.ticketModel.countTicket(ticketInfo.id, 2, ticketInfo.customer))

    header.open_tickets > 0
      ? header.percent_open_tickets = (header.open_tickets * 100 / parseInt(header.total_tickets)).toFixed(2)
      : header.percent_open_tickets = 0

    header.closed_tickets > 0
      ? header.percent_closed_tickets = (header.closed_tickets * 100 / parseInt(header.total_tickets)).toFixed(2)
      : header.percent_closed_tickets = 0

    return header
  }

  async getByIDPaged(req, res) {
    const search = req.query.search ? req.query.search : false

    try {
      req.query.offset = Math.round(req.query.limit * (req.query.offset - 1))
      let status,
        tickets = {
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
      if (!req.query.status) {
        status = [1, 2, 3]
      } else status = JSON.parse(req.query.status)

      if (search) {
        for await (const id of status) {
          if (!req.query.me || req.query.me === "false") {

            tickets[id] = await this.ticketModel.searchTicket(
              req.headers.authorization,
              search,
              req.params.id,
              id,
              req.query.limit,
              req.query.offset,

            )
          } else {
            tickets[id] = await this.ticketModel.searchTicketWithMe(
              req.headers.authorization,
              search,
              req.params.id,
              id,
              req.query.limit,
              req.query.offset,
              req.query.me
            )
          }

          for (const x in tickets[id].tickets) {
            tickets[id].tickets[x] = await this.formatTicket.formatTicketForPhase({ id: req.params.id }, tickets[id].tickets[x])
          }
        }
      } else if (status && Array.isArray(status)) {
        for await (const id of status) {
          let result
          if (!req.query.me || req.query.me == "false") {
            result = await this.ticketModel.getTicketByPhasePaged(req.params.id, id, req.query.limit, req.query.offset)
            tickets[id].total = await this.ticketModel.countTicket(req.params.id, id, false)
          } else {
            result = await this.ticketModel.getTicketByPhasePagedWithMe(req.params.id, id, req.query.limit, req.query.offset, req.query.me)
            tickets[id].total = await this.ticketModel.countTicketWithMe(req.params.id, id, req.query.me)
          }

          for await (let ticket of result) {
            tickets[id].tickets = tickets[id].tickets.concat(await this.formatTicket.formatTicketForPhase(
              { id: req.params.id, id_form_template: ticket.id_form_template },
              ticket
            ))

            if (tickets[id].tickets) {
              tickets[id].tickets.map(item => {
                if (item.form_data?._id) delete item.form_data._id
                if (item.id_form_template) delete item.id_form_template
              })
            }
          }
        }
      }
      return res.status(200).send(tickets)
    } catch (err) {
      console.log('Erro ao buscar a fase =>', err)
      return res.status(500).send(err)
    }
  }
}