export default class SLAModel {
  constructor(database = {}, logger = {}) {
    this.database = database
    this.logger = logger
  }
  async slaPhaseSettings(obj) {
    try {
      await this.database('phase_sla_settings').delete().where('id_phase', obj.id_phase)
      return await this.database('phase_sla_settings').insert(obj)
    } catch (err) {
      this.logger.error(err, 'Error sla phase settings.')
      return err
    }
  }

  async getSLASettings(idPhase) {
    try {
      const query = await this.database.raw(`
      SELECT * FROM phase_sla_settings 
      LEFT JOIN sla_type ON sla_type.id = phase_sla_settings.id_sla_type 
      WHERE phase_sla_settings.id_phase = '${idPhase}' 
      AND phase_sla_settings.active = true`)
      return query.rows
    } catch (err) {
      this.logger.error(err, 'Get sla settings.')
      return err
    }
  }

  async getSLAEmDia(id_phases, id_company) {
    try {
      const query = await this.database.raw(`
      SELECT COUNT(*) FROM ticket_sla_control 
      LEFT JOIN ticket ON ticket.id = ticket_sla_control.id_ticket 
      WHERE active = true 
      AND interaction_time is null 
      AND id_sla_status = 1 
      AND ticket.id_status != 3 
      AND ticket.id_company = '${id_company}' 
      AND ticket_sla_control.id_phase IN (${id_phases});
      `)
      return query.rows[0].count
    } catch (err) {
      console.log(err)
      return err
    }
  }

  async getSLAAtrasado(id_phases, id_company) {
    try {
      const query = await this.database.raw(`    
      SELECT COUNT(*) FROM ticket_sla_control 
      LEFT JOIN ticket ON ticket.id = ticket_sla_control.id_ticket 
      WHERE active = true 
      AND interaction_time is null 
      AND id_sla_status = 2
      AND ticket.id_status != 3 
      AND ticket.id_company = '${id_company}' 
      AND ticket_sla_control.id_phase IN (${id_phases});
      `)
      return query.rows[0].count
    } catch (err) {
      console.log(err)
      return err
    }
  }

  async getSLASettingsType(idPhase, type) {
    try {
      return await this.database('phase_sla_settings')
        .leftJoin('sla_type', 'sla_type.id', 'phase_sla_settings.id_sla_type')
        .where('phase_sla_settings.id_phase', idPhase)
        .andWhere('sla_type.id', type)
    } catch (err) {
      this.logger.error(err, 'Get sla settings.')
      return err
    }
  }

  async slaTicketControl(obj) {
    try {
      return await this.database('ticket_sla_control').insert(obj)
    } catch (err) {
      this.logger.error(err, 'Error sla ticket control.')
      return err
    }
  }

  async getTicketControl(id_phase, id_status, id_sla_type, status = true) {
    try {
      const result = await this.database('ticket_sla_control as tsc')
        .count()
        .leftJoin('phase_ticket as pt', 'pt.id_ticket', 'tsc.id_ticket')
        .leftJoin('ticket', 'ticket.id', 'pt.id_ticket')
        .where('pt.id_phase', id_phase)
        .andWhere('tsc.id_sla_status', id_status)
        .andWhere('pt.active', true)
        .andWhere('tsc.id_sla_type', id_sla_type)
        .andWhere('tsc.active', status)
      return result[0].count
    } catch (err) {
      this.logger.error(err, "error when get sla's.")
      return err
    }
  }

  async getByPhaseTicket(id_phase, id_ticket) {
    try {
      return await this.database('ticket_sla_control as tsc')
        .select({
          id_sla_type: 'tsc.id_sla_type',
          id_sla_status: 'tsc.id_sla_status',
          limit_sla_time: 'tsc.limit_sla_time',
          interaction_time: 'tsc.interaction_time',
          active: 'tsc.active',
          name: 'ss.name'
        })
        .leftJoin('phase_ticket as pt', 'pt.id_ticket', 'tsc.id_ticket')
        .leftJoin('sla_status as ss', 'ss.id', 'tsc.id_sla_status')
        .where('tsc.id_phase', id_phase)
        .andWhere('tsc.id_ticket', id_ticket)
        .andWhere('pt.active', true)
        .orderBy('tsc.id_sla_type', 'asc')
    } catch (err) {
      this.logger.error(err, 'getByPhaseTicket error =>.')
      return err
    }
  }

  async checkSLA(type) {
    try {
      // Pega todos os tickets com status em aberto e atualiza seus status.
      return await this.database('ticket_sla_control as tsc')
        .where('tsc.id_sla_status', 1)
        .andWhere('tsc.id_sla_type', type)
        .andWhere('tsc.active', true)
    } catch (err) {
      this.logger.error(err, 'Error check sla.')
      return err
    }
  }

  async updateTicketSLA(id_ticket, obj, id_type, id_phase) {
    try {
      return await this.database('ticket_sla_control')
        .update(obj)
        .where('id_ticket', id_ticket)
        .andWhere('id_sla_type', id_type)
        .andWhere('id_phase', id_phase)
    } catch (err) {
      this.logger.error(err, 'Error when update sla ticket.')
      return err
    }
  }

  async disableSLA(id_ticket) {
    try {
      return await this.database('ticket_sla_control').update({ active: false }).where('id_ticket', id_ticket)
    } catch (err) {
      this.logger.error(err, 'Error when disable sla ticket.')
      return err
    }
  }

  async getSLAControl(id_phase, id_ticket) {
    try {
      return await this.database('ticket_sla_control as tsc')
        .select(
          'sla_status.name as status',
          'sla_type.name as type',
          'tsc.limit_sla_time',
          'tsc.interaction_time',
          'tsc.id_sla_type',
          'tsc.id_sla_status',
          'tsc.created_at',
          'tsc.active'
        )
        .leftJoin('sla_type', 'sla_type.id', 'tsc.id_sla_type')
        .leftJoin('sla_status', 'sla_status.id', 'tsc.id_sla_status')
        .where('tsc.id_phase', id_phase)
        .andWhere('tsc.id_ticket', id_ticket)
    } catch (err) {
      this.logger.error(err, "Error when get sla's.")
      return err
    }
  }

  async getForDash(id_phase, id_ticket) {
    try {
      return await this.database('ticket_sla_control as tsc')
        .select('tsc.*')
        .leftJoin('phase_ticket as pt', 'pt.id_ticket', 'tsc.id_ticket')
        .leftJoin('sla_status as ss', 'ss.id', 'tsc.id_sla_status')
        .where('tsc.id_phase', id_phase)
        .andWhere('tsc.id_ticket', id_ticket)
        .andWhere('pt.active', true)
    } catch (err) {
      this.logger.error(err, "Error when get sla's.")
      return err
    }
  }

  async getToCountSLA(id_phase, closed = false) {
    let tickets
    if (closed) {
      tickets = await this.database.raw(`
      select ticket_sla_control.*, ticket.id_status 
      from ticket_sla_control 
      left join phase_ticket on phase_ticket.id_ticket = ticket_sla_control.id_ticket 
      left join ticket on ticket.id = ticket_sla_control.id_ticket 
      where ticket_sla_control.id_phase = '${id_phase}'
      and phase_Ticket.id_phase = '${id_phase}' 
      and ticket_sla_control.id_sla_type = 1
      and phase_ticket.active = true 
      and ticket.id_status = 3;
      `)
    } else {
      tickets = await this.database.raw(`
      select ticket_sla_control.*, ticket.id_status 
      from ticket_sla_control 
      left join phase_ticket on phase_ticket.id_ticket = ticket_sla_control.id_ticket 
      left join ticket on ticket.id = ticket_sla_control.id_ticket 
      where ticket_sla_control.id_phase = '${id_phase}' 
      and ticket_sla_control.id_sla_type = 1
      and phase_Ticket.id_phase = '${id_phase}'
      and phase_ticket.active = true 
      and ticket.id_status != 3;
      `)
    }

    return tickets.rows
  }

  async getToCountSLAWithCustomer(id_phase, closed = false, customer) {
    let tickets
    if (closed) {
      tickets = await this.database.raw(`
      select ticket_sla_control.*, ticket.id_status 
      from ticket_sla_control 
      left join phase_ticket on phase_ticket.id_ticket = ticket_sla_control.id_ticket 
      left join ticket on ticket.id = ticket_sla_control.id_ticket 
      left join customer on customer.id_ticket = ticket.id
      where ticket_sla_control.id_phase = '${id_phase}'
      and phase_ticket.id_phase = '${id_phase}' 
      and ticket_sla_control.id_sla_type = 1
      and phase_ticket.active = true 
      and ticket.id_status = 3
      and customer.crm_contact_id = '${customer}';
      `)
    } else {
      tickets = await this.database.raw(`
      select ticket_sla_control.*, ticket.id_status 
      from ticket_sla_control 
      left join phase_ticket on phase_ticket.id_ticket = ticket_sla_control.id_ticket 
      left join ticket on ticket.id = ticket_sla_control.id_ticket 
      left join customer on customer.id_ticket = ticket.id
      where ticket_sla_control.id_phase = '${id_phase}' 
      and ticket_sla_control.id_sla_type = 1
      and phase_ticket.id_phase = '${id_phase}'
      and phase_ticket.active = true 
      and ticket.id_status != 3
      and customer.crm_contact_id = '${customer}';
      `)
    }

    return tickets.rows
  }

  async getAllTicketsWithoutSLA(id_phase, closed) {
    const tickets = await this.database('ticket').count().where({ id_phase }).andWhere('closed', closed)
    return tickets[0].count
  }
}
