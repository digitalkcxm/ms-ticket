import moment from 'moment'
const tableName = 'ticket'
export default class TicketModel {
  constructor(database = {}, logger = {}) {
    this.database = database
    this.logger = logger
  }
  async create(obj) {
    try {
      return await this.database(tableName).returning(['id', 'id_seq']).insert(obj)
    } catch (err) {
      this.logger.error(err, 'Error 1111 when create ticket.')
      return err
    }
  }
  async createPhaseTicket(obj) {
    try {
      return await this.database('phase_ticket').returning(['id']).insert(obj)
    } catch (err) {
      this.logger.error(err, 'Error when create phase ticket.')
      return err
    }
  }

  async createResponsibleTicket(obj) {
    try {
      return await this.database('responsible_ticket').returning(['id']).insert(obj)
    } catch (err) {
      this.logger.error(err, 'Error when create responsible ticket.')
      return err
    }
  }
  async getTicketById(id, id_company) {
    try {
      return await this.database(tableName)
        .select({
          id: `${tableName}.id`,
          id_seq: `${tableName}.id_seq`,
          id_company: `${tableName}.id_company`,
          phase_id: 'phase_ticket.id_phase',
          phase: 'phase.name',
          id_user: 'users.id_users',
          user: 'users.name',
          sla_time: 'phase.sla_time',
          id_unit_of_time: 'phase.id_unit_of_time',
          form: 'phase.form',
          closed: `${tableName}.closed`,
          department_origin: 'department.id_department_core',
          created_at: `${tableName}.created_at`,
          updated_at: `${tableName}.updated_at`,
          start_ticket: 'ticket.start_ticket',
          display_name: 'ticket.display_name',
          id_ticket_father: 'ticket.id_ticket_father',
          id_protocol: 'ticket.id_protocol',
          status: 'ticket.status',
          id_status: 'ticket.id_status',
          id_tab: 'ticket.id_tab'
        })
        .leftJoin('users', 'users.id', `${tableName}.id_user`)
        .leftJoin('phase_ticket', 'phase_ticket.id_ticket', `${tableName}.id`)
        .leftJoin('phase', 'phase.id', 'phase_ticket.id_phase')
        .leftJoin('department', 'department.id', 'ticket.department_origin')
        .where(`${tableName}.id`, id)
        .andWhere(`${tableName}.id_company`, id_company)
        .orderBy('phase_ticket.id', 'desc')
        .limit(1)
    } catch (err) {
      this.logger.error(err, 'Error when get ticket by id.')
      return err
    }
  }

  async getTicketToCronSLA(id) {
    try {
      return await this.database(tableName)
        .select({
          id: `${tableName}.id`,
          id_company: `${tableName}.id_company`
        })
        .where(`${tableName}.id`, id)
    } catch (err) {
      this.logger.error(err, 'Error when get ticket by id.')
      return err
    }
  }

  async getTicketByIdSeq(id_seq, id_company) {
    try {
      return await this.database(tableName)
        .select({
          id: `${tableName}.id`,
          id_seq: `${tableName}.id_seq`,
          id_company: `${tableName}.id_company`,
          phase_id: 'phase_ticket.id_phase',
          phase: 'phase.name',
          id_user: 'users.id_users',
          name: 'users.name',
          id_unit_of_time: 'phase.id_unit_of_time',
          form: 'phase.form',
          closed: `${tableName}.closed`,
          id_form: `phase_ticket.id_form`,
          department_origin: 'department.id_department_core',
          created_at: `${tableName}.created_at`,
          updated_at: `${tableName}.updated_at`,
          start_ticket: 'ticket.start_ticket',
          display_name: 'ticket.display_name',
          id_ticket_father: 'ticket.id_ticket_father',
          id_protocol: 'ticket.id_protocol',
          status: 'status_ticket.name',
          id_tab: 'ticket.id_tab'
        })
        .leftJoin('users', 'users.id', `${tableName}.id_user`)
        .leftJoin('phase_ticket', 'phase_ticket.id_ticket', `${tableName}.id`)
        .leftJoin('phase', 'phase.id', 'phase_ticket.id_phase')
        .leftJoin('department', 'department.id', 'ticket.department_origin')
        .leftJoin('status_ticket', 'status_ticket.id', 'ticket.id_status')
        .where(`${tableName}.id_seq`, id_seq)
        .andWhere(`${tableName}.id_company`, id_company)
        .orderBy('phase_ticket.id', 'desc')
        .limit(1)
    } catch (err) {
      this.logger.error(err, 'Error when get ticket by id.')
      return err
    }
  }

  async getAllTickets(id_company, obj) {
    try {
      let stringWhere = `${tableName}.id_company = '${id_company}' ${obj.history_phase === "true" ? `AND phase_ticket.active = true ` : ""}  `

      if (obj.department && obj.department.length > 0) {
        stringWhere = stringWhere + ` AND department.id_department_core in (${obj.department}) `
      }
      if (obj.users && obj.users.length > 0) {
        stringWhere = stringWhere + ` AND users.id_users in (${obj.users}) `
      }
      if (obj.closed && obj.closed.length > 0) {
        stringWhere = stringWhere + ` AND ticket.closed in (${obj.closed}) `
      }
      if (obj.range && obj.range.length > 0) {
        stringWhere = stringWhere + `AND ticket.created_at >= '${obj.range[0]}' AND ticket.created_at <= '${obj.range[1]}'`
      }

      const result = await this.database.raw(`
      SELECT DISTINCT(phase_ticket.id) AS phase_ticket_id,
        ticket.id, 
        ticket.id_seq, 
        ticket.id_protocol, 
        phase.id AS id_phase, 
        phase.name AS phase, 
        users.id_users, 
        users.name, 
        phase.form, 
        ticket.closed, 
        ticket.id_form, 
        ticket.department_origin, 
        ticket.created_at, 
        ticket.updated_at, 
        ticket.id_tab ,
        ticket.display_name as customer,
        customer.identification_document,
        customer.phone,
        customer.email
      from ticket 
      left join 
        users on users.id = ticket.id_user 
      left join 
        phase_ticket on phase_ticket.id_ticket = ticket.id 
      left join 
        phase on phase.id = phase_ticket.id_phase 
      left join 
        department_phase on department_phase.id_phase = phase.id 
      left join 
        department on department.id = department_phase.id_department 
      left join 
        customer on customer.id_ticket = ticket.id
      where ${stringWhere}`)
      return result.rows
    } catch (err) {
      this.logger.error(err, 'Error when get ticket by id.')
      return err
    }
  }

  async getTypeAttachments(type) {
    try {
      return await this.database('type_attachments').where('name', type)
    } catch (err) {
      this.logger.error(err, 'Error when get type attachments by id.')
      return err
    }
  }

  async updateTicket(obj, id, id_company) {
    try {
      return await this.database(tableName).update(obj).where('id', id).andWhere('id_company', id_company)
    } catch (err) {
      this.logger.error(err, `Update ticket with ID ${id}.`)
      return err
    }
  }

  async delResponsibleTicket(id_ticket) {
    try {
      return await this.database('responsible_ticket').andWhere('id_ticket', id_ticket).del()
    } catch (err) {
      this.logger.error(err, 'Error when get responsible Ticket.')
      return err
    }
  }

  async closedTicket(id_ticket, id_user) {
    try {
      return await this.database(tableName)
        .returning(['id'])
        .update({
          closed: true,
          updated_at: moment().format(),
          id_status: 3,
          status: 'Finalizado',
          time_closed_ticket: moment().format(),
          user_closed_ticket: id_user
        })
        .where('id', id_ticket)
    } catch (err) {
      this.logger.error(err, 'Error when update Ticket to closed')
      return err
    }
  }

  async getAllTicketWhitoutCompanyId() {
    try {
      return await this.database(tableName).select().where('sla', false)
    } catch (err) {
      this.logger.error(err, 'Error when catch all ticket.')
      return err
    }
  }

  async updateSlaTicket(obj, id) {
    try {
      return await this.database(tableName).update(obj).where('id', id)
    } catch (err) {
      this.logger.error(err, 'Error when update sla ticket.')
      return err
    }
  }

  async getCountResponsibleTicket(id_company, obj) {
    try {
      let stringWhere = `users.id_company = '${id_company}'`

      if (obj.department && obj.department.length > 0) {
        stringWhere = stringWhere + ` AND department.id_department_core in (${obj.department}) `
      }
      if (obj.users && obj.users.length > 0) {
        stringWhere = stringWhere + ` AND users.id_users in (${obj.users}) `
      }
      if (obj.closed && obj.closed.length > 0) {
        stringWhere = stringWhere + ` AND ticket.closed in (${obj.closed}) `
      }
      if (obj.range && obj.range.length > 0) {
        stringWhere = stringWhere + `AND ticket.created_at >= '${obj.range[0]}' AND ticket.created_at <= '${obj.range[1]}'`
      }
      return await this.database('ticket')
        .select('users.id_users as id_user')
        .count('ticket.id as count')
        .leftJoin('responsible_ticket', 'responsible_ticket.id_ticket', 'ticket.id')
        .leftJoin('users', 'users.id', 'responsible_ticket.id_user')
        .leftJoin('phase_ticket', 'phase_ticket.id_ticket', `ticket.id`)
        .leftJoin('phase', 'phase.id', 'phase_ticket.id_phase')
        .leftJoin('department_phase', 'department_phase.id_phase', 'phase.id')
        .leftJoin('department', 'department.id', 'department_phase.id_department')
        .whereRaw(stringWhere)
        .groupBy('users.id_users')
    } catch (err) {
      this.logger.error(err, 'Error when get all responsible ticket.')
      return err
    }
  }

  async getTicketByPhase(id_phase) {
    try {
      return await this.database('ticket')
        .select({
          id: 'ticket.id',
          id_seq: 'ticket.id_seq',
          id_user: 'users.id_users',
          user: 'users.name',
          closed: 'ticket.closed',
          created_at: 'ticket.created_at',
          updated_at: 'ticket.updated_at',
          display_name: 'ticket.display_name',
          status: 'ticket.status',
          id_status: 'ticket.id_status',
          id_tab: 'ticket.id_tab'
        })
        .leftJoin('users', 'users.id', 'ticket.id_user')
        .where('ticket.id_phase', id_phase)
    } catch (err) {
      this.logger.error(err, 'Error when get Ticket by phase.')
      return err
    }
  }

  async getTicketByPhaseAndStatus(id_phase, status) {
    try {
      return await this.database('ticket')
        .select({
          id: 'ticket.id',
          id_seq: 'ticket.id_seq',
          id_user: 'users.id_users',
          user: 'users.name',
          closed: 'ticket.closed',
          created_at: 'ticket.created_at',
          updated_at: 'ticket.updated_at',
          display_name: 'ticket.display_name',
          status: 'ticket.status',
          id_tab: 'ticket.id_tab'
        })

        .leftJoin('users', 'users.id', 'ticket.id_user')
        .whereIn('ticket.closed', status)
        .andWhere('ticket.id_phase', id_phase)
    } catch (err) {
      this.logger.error(err, 'Error when get Ticket by phase.')
      return err
    }
  }

  async countTicket(id_phase, status, customer = false) {
    let result
    if (customer) {
      result = await this.database('phase_ticket')
        .count('ticket.id')
        .leftJoin('ticket', 'ticket.id', 'phase_ticket.id_ticket')
        .leftJoin('customer', 'customer.id_ticket', 'phase_ticket.id_ticket')
        .where('phase_ticket.id_phase', id_phase)
        .andWhere('phase_ticket.active', true)
        .andWhere('ticket.closed', status)
        .andWhere('customer.crm_contact_id', customer)
    } else {
      result = await this.database('phase_ticket')
        .count('ticket.id')
        .leftJoin('ticket', 'ticket.id', 'phase_ticket.id_ticket')
        .where('phase_ticket.id_phase', id_phase)
        .andWhere('phase_ticket.active', true)
        .andWhere('ticket.closed', status)
    }

    return result[0].count
  }

  async countAllTicket(id_phase, customer = false) {
    let result
    if (customer) {
      result = await this.database('phase_ticket')
        .count('ticket.id')
        .leftJoin('ticket', 'ticket.id', 'phase_ticket.id_ticket')
        .leftJoin('customer', 'customer.id_ticket', 'phase_ticket.id_ticket')
        .where('phase_ticket.id_phase', id_phase)
        .andWhere('phase_ticket.active', true)
        .andWhere('customer.crm_contact_id', customer)
    } else {
      result = await this.database('phase_ticket')
        .count('ticket.id')
        .leftJoin('ticket', 'ticket.id', 'phase_ticket.id_ticket')
        .where('phase_ticket.id_phase', id_phase)
        .andWhere('phase_ticket.active', true)
    }

    return result[0].count
  }

  async getTicketByCustomerOrProtocol(id) {
    try {
      return this.database(tableName)
        .select({
          id: 'ticket.id',
          id_seq: 'ticket.id_seq',
          id_protocol: 'ticket.id_protocol',
          id_user: 'users.id_users',
          user: 'users.name',
          closed: 'ticket.closed',
          id_unit_of_time: 'phase.id_unit_of_time',
          id_form: 'ticket.id_form',
          name: 'phase.name',
          department_origin: 'department.id_department_core',
          created_at: 'phase_ticket.created_at',
          updated_at: 'ticket.updated_at',
          display_name: 'ticket.display_name',
          id_ticket_father: 'ticket.id_ticket_father',
          id_tab: `ticket.id_tab`,
          phase_id: 'phase.id'
        })
        .leftJoin('users', 'users.id', 'ticket.id_user')
        .leftJoin('phase_ticket', 'phase_ticket.id_ticket', `${tableName}.id`)
        .leftJoin('department', 'department.id', 'ticket.department_origin')
        .leftJoin('phase', 'phase.id', 'phase_ticket.id_phase')
        .leftJoin('customer', 'customer.id_ticket', 'ticket.id')
        .where('phase_ticket.active', true)
        .andWhere('customer.crm_contact_id', id)
        .orWhere('ticket.id_protocol', id)
    } catch (err) {
      this.logger.error(err, 'Error when get ticket by customer or protocol.')
      return err
    }
  }

  async last_interaction() {
    try {
      return await this.database('activities_ticket')
        .select('users.name')
        .leftJoin('users', 'users.id', 'activities_ticket.id_user')
        .orderBy('activities_ticket.created_at', 'desc')
        .limit(1)
    } catch (err) {
      this.logger.error(err, 'Eggor get last interaction phase')
      return err
    }
  }

  async first_interaction(id) {
    try {
      return await this.database('activities_ticket').select('created_at').where('id_ticket', id).orderBy('created_at', 'asc').limit(1)
    } catch (err) {
      this.logger.error(err, `Error when get first interaction ticket with ID ${id}`)
      return err
    }
  }

  async last_interaction_ticket(id) {
    try {
      return await this.database('activities_ticket')
        .select(['users.id_users', 'users.name'])
        .leftJoin('users', 'users.id', 'activities_ticket.id_user')
        .where('id_ticket', id)
        .orderBy('activities_ticket.created_at', 'desc')
        .limit(1)
    } catch (err) {
      this.logger.error(err, `Error when get last interaction ticket with ID ${id}`)
      return err
    }
  }

  async getTicketStatusCount(id_company) {
    try {
      return await this.database('vw_dash_tickets').select('*').where('id_company', id_company).limit(1)
    } catch (err) {
      this.logger.error(err, 'Error when get view dash ticket.')
      return err
    }
  }

  async getTicketByIDForm(id_form, id_phase) {
    try {
      const data = await this.database('phase_ticket')
        .select({
          id: 'ticket.id',
          id_seq: 'ticket.id_seq',
          ids_crm: 'ticket.ids_crm',
          id_user: 'users.id_users',
          id_customer: 'ticket.id_customer',
          id_protocol: 'ticket.id_protocol',
          closed: 'ticket.closed',
          sla: 'ticket.sla',
          id_form: `ticket.id_form`,
          department_origin: `ticket.department_origin`,
          created_at: 'ticket.created_at',
          updated_at: 'ticket.updated_at',
          id_tab: `ticket.id_tab`
        })
        .leftJoin('ticket', 'ticket.id', 'phase_ticket.id_ticket')
        .leftJoin('users', 'users.id', 'ticket.id_user')
        .where('phase_ticket.id_phase', id_phase)
        .andWhere('phase_ticket.active', true)
        .where('ticket.id_form', id_form)

      return data[0]
    } catch (err) {
      this.logger.error(err, 'Error when select ticket by id Form.')
      return err
    }
  }

  async getHistoryTicket(id_ticket) {
    try {
      return await this.database('phase_ticket')
        .select({
          id: 'phase_ticket.id',
          id_phase: 'phase_ticket.id_phase',
          name: 'phase.name',
          template: 'phase.id_form_template',
          id_user: 'users.id_users',
          user: 'users.name',
          id_form: 'phase_ticket.id_form',
          created_at: 'phase_ticket.created_at'
        })
        .leftJoin('users', 'users.id', 'phase_ticket.id_user')
        .leftJoin('phase', 'phase.id', 'phase_ticket.id_phase')
        .where('phase_ticket.id_ticket', id_ticket)
        .orderBy('phase_ticket.created_at', 'desc')
    } catch (err) {
      this.logger.error(err, 'Error when select history ticket.')
      return err
    }
  }

  async getFormTicket(id_ticket) {
    try {
      return await this.database('phase_ticket')
        .select({
          id_form: 'id_form',
          id_phase: 'id_phase'
        })
        .where('id_ticket', id_ticket)
        .andWhere('active', true)
    } catch (err) {
      this.logger.error(err, 'Error when select history ticket.')
      return err
    }
  }

  async getFirstFormTicket(id_ticket) {
    try {
      return await this.database('phase_ticket')
        .select('phase.id', 'phase.id_form_template', 'phase_ticket.created_at', 'phase.form', 'phase_ticket.id_form')
        .leftJoin('phase', 'phase.id', 'phase_ticket.id_phase')
        .where('phase_ticket.id_ticket', id_ticket)
        .andWhere('phase_ticket.active', true)
        .orderBy('phase_ticket.created_at', 'asc')
    } catch (err) {
      this.logger.error(err, 'Error Get First Form Ticket.')
      return err
    }
  }

  async getResponsibleByTicketAndUser(id_ticket, id_user) {
    try {
      return await this.database('responsible_ticket')

        .where('id_ticket', id_ticket)
        .andWhere('id_user', id_user)
    } catch (err) {
      this.logger.error(err, 'Error get responsible by ticket and user.')
      return err
    }
  }

  async updateResponsible(id_ticket, id_user, obj) {
    try {
      return await this.database('responsible_ticket').update(obj).where('id_ticket', id_ticket).andWhere('id_user', id_user)
    } catch (err) {
      this.logger.error(err, 'Error update responsible')
      return err
    }
  }

  async linkProtocolToticket(obj) {
    try {
      return await this.database('ticket_protocol').insert(obj)
    } catch (err) {
      this.logger.error(err, 'Erro ao linkar o protocolo ao ticket')
      return err
    }
  }

  async getProtocolTicket(id_ticket, id_company) {
    try {
      return await this.database('ticket_protocol')
        .select({
          id: 'ticket_protocol.id',
          id_ticket: 'ticket_protocol.id_ticket',
          id_protocol: 'ticket_protocol.id_protocol',
          created_at: 'ticket_protocol.created_at',
          updated_at: 'ticket_protocol.updated_at',
          id_user: 'users.id_users',
          created_by_ticket: 'ticket_protocol.created_by_ticket'
        })
        .leftJoin('users', 'users.id', `ticket_protocol.id_user`)
        .where('ticket_protocol.id_ticket', id_ticket)
        .andWhere('ticket_protocol.id_company', id_company)
    } catch (err) {
      this.logger.error(err, 'Erro ao linkar o protocolo ao ticket.')
      return err
    }
  }

  async insertViewTicket(obj) {
    try {
      return await this.database('view_ticket').insert(obj)
    } catch (err) {
      this.logger.error(err, 'error insert view ticket.')
      return false
    }
  }

  async getViewTicket(id_ticket) {
    try {
      return await this.database('view_ticket')
        .select({
          id_ticket: 'view_ticket.id_ticket',
          start: 'view_ticket.start',
          end: 'view_ticket.end',
          id_user: 'users.id_users',
          user: 'users.name'
        })
        .leftJoin('users', 'users.id', `view_ticket.id_user`)
        .where('id_ticket', id_ticket)
    } catch (err) {
      this.logger.error(err, 'error get view ticket.')
      return false
    }
  }

  async getProtocolCreatedByTicket(id_ticket, id_company) {
    try {
      return await this.database('ticket_protocol')
        .select({
          id_protocol: 'ticket_protocol.id_protocol',
          created_at: 'ticket_protocol.created_at',
          id_user: 'users.id_users',
          user: 'users.name'
        })
        .leftJoin('users', 'users.id', `ticket_protocol.id_user`)
        .where('ticket_protocol.id_ticket', id_ticket)
        .andWhere('ticket_protocol.id_company', id_company)
    } catch (err) {
      this.logger.error(err, 'Erro ao linkar o protocolo ao ticket.')
      return err
    }
  }

  async getTicketCreatedByTicketFather(id_ticket, id_company) {
    try {
      return await this.database('ticket')
        .select({
          id_seq: 'ticket.id_seq',
          id_user: 'users.id_users',
          user: 'users.name',
          created_at: 'ticket.created_at'
        })
        .leftJoin('users', 'users.id', `ticket.id_user`)
        .where('created_by_ticket', true)
        .andWhere('id_ticket_father', id_ticket)
        .andWhere('ticket.id_company', id_company)
    } catch (err) {
      this.logger.error(err, 'error get ticket created by ticket.')
      return []
    }
  }

  async getStatusTicketById(id, id_company) {
    try {
      return await this.database('ticket')
        .select({
          created_by_ticket: 'ticket.created_by_ticket',
          id_ticket_father: 'ticket.id_ticket_father',
          created_by_protocol: 'ticket.created_by_protocol',
          id_protocol: 'ticket.id_protocol',
          id_user: 'users.id_users',
          user: 'users.name',
          created_at: 'ticket.created_at',
          status: 'ticket.id_status',
          time_closed_ticket: 'ticket.time_closed_ticket',
          user_closed_ticket: 'ticket.user_closed_ticket'
        })
        .leftJoin('users', 'users.id', `${tableName}.id_user`)
        .where(`ticket.id`, id)
        .andWhere(`ticket.id_company`, id_company)
    } catch (err) {
      this.logger.error(err, 'Error when get ticket by id.')
      return err
    }
  }

  async searchTicket(id_company, search, id_phase, status) {
    try {
      if (typeof search === 'string') search = search.toLowerCase()
      const default_where = `ticket.id_company = '${id_company}' AND phase.id = '${id_phase}' AND phase_ticket.active = true AND ticket.closed IN (${status
        .replace('[', '')
        .replace(']', '')
        .replace(/\"/g, "'")}) AND phase_ticket.active = true AND`
      let query
      if (isNaN(search)) {
        search = search.replace('"', '').replace('"', '')
        query = `
        ${default_where} users.name ILIKE '%${search}%' OR 
        ${default_where} customer.name ILIKE '%${search}%' OR 
        ${default_where} ticket.display_name ILIKE '%${search}%'`
      } else {
        query = `
        ${default_where} CAST(ticket.id_seq AS TEXT) ILIKE '%${search}%' OR 
        ${default_where} CAST(ticket.id_protocol AS TEXT) ILIKE '%${search}%' OR
        ${default_where} CAST(ticket.id_user AS TEXT) ILIKE '%${search}%' OR
        ${default_where} CAST(ticket_protocol.id_protocol AS TEXT) ILIKE '%${search}%'`
      }

      const result = await this.database.raw(`
      select 
        ticket.id,
        ticket.id_seq,
        ticket.id_company,
        phase_ticket.id_phase as id_phase,
        phase.name as phase,
        users.id_users as id_users_core,
        users.name,
        phase.form,
        ticket.closed,
        ticket.department_origin,
        ticket.created_at,
        ticket.updated_at,
        ticket.display_name,
        status_ticket.name as status
      from ticket
      left join responsible_ticket as rt on rt.id_ticket = ticket.id
      left join users on users.id = rt.id_user
      left join phase_ticket on phase_ticket.id_ticket = ticket.id
      left join phase on phase.id = phase_ticket.id_phase
      left join customer on customer.id_ticket = ticket.id
      left join ticket_protocol on ticket_protocol.id_ticket = ticket.id
      left join status_ticket on status_ticket.id = ticket.id_status
      where ${query} order by ticket.created_at desc`)

      return result.rows
    } catch (err) {
      this.logger.error(err, 'Error when get ticket by id.')
      return err
    }
  }

  async getTicketByFatherToHistory(id_ticket, id_company) {
    try {
      return await this.database('ticket')
        .select({
          id_seq: 'ticket.id_seq',
          id_user: 'users.id_users',
          created_at: 'ticket.created_at',
          closed: 'ticket.closed',
          department_origin: 'department.id_department_core',
          phase_name: 'phase.name',
          display_name: 'ticket.display_name',
          id_protocol: 'ticket.id_protocol'
        })
        .leftJoin('users', 'users.id', `ticket.id_user`)
        .leftJoin('phase_ticket', 'phase_ticket.id_ticket', 'ticket.id')
        .leftJoin('phase', 'phase.id', 'phase.id_phase')
        .leftJoin('department', 'department.id', 'ticket.department_origin')
        .where('created_by_ticket', true)
        .andWhere('id_ticket_father', id_ticket)
        .andWhere('ticket.id_company', id_company)
        .andWhere('phase_ticket.active', true)
    } catch (err) {
      this.logger.error(err, 'error get ticket created by ticket.')
      return []
    }
  }
}
