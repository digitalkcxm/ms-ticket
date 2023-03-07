export default class DashModel {
  constructor(database = {}) {
    this.database = database
  }

  async total_phase(department, id_company) {
    const total_fases = await this.database.raw(`
    SELECT COUNT(phase.id) 
    FROM department_phase 
    LEFT JOIN department ON department.id = department_phase.id_department 
    LEFT JOIN phase ON phase.id = department_phase.id_phase 
    WHERE department_phase.active = true 
    AND phase.active = true 
    AND department.id_department_core = ${department} 
    AND phase.id_company = '${id_company}'
    `)
    return total_fases.rows[0].count
  }

  async total_tickets(department, id_company) {

    const total_tickets = await this.database.raw(`
    SELECT COUNT(ticket.id)
    FROM ticket
    LEFT JOIN phase ON phase.id = ticket.id_phase
    LEFT JOIN department_phase dp ON dp.id_phase = phase.id
    LEFT JOIN department ON department.id = dp.id_department
    WHERE ticket.id_company = '${id_company}'
    AND dp.active = true
    AND phase.active = true
    AND department.id_department_core = ${department}
    `)

    return total_tickets.rows[0].count
  }

  async total_tickets_fechados(department, id_company) {
    const total_tickets_fechados = await this.database.raw(`
    SELECT COUNT(ticket.id)
    FROM ticket
    LEFT JOIN phase on phase.id = ticket.id_phase
    LEFT JOIN department_phase dp ON dp.id_phase = phase.id
    LEFT JOIN department ON department.id = dp.id_department
    WHERE ticket.id_company = '${id_company}'
    AND phase.active = true
    AND ticket.id_status = 3
    AND dp.active = true
    AND department.id_department_core = ${department}
    `)

    return total_tickets_fechados.rows[0].count
  }

  async total_tickets_nao_iniciado(department, id_company) {
    const total_tickets_nao_iniciado = await this.database.raw(`
    SELECT COUNT(ticket.id)
    FROM ticket
    LEFT JOIN phase on phase.id = ticket.id_phase
    LEFT JOIN department_phase dp ON dp.id_phase = phase.id
    LEFT JOIN department ON department.id = dp.id_department
    WHERE ticket.id_company = '${id_company}'
    AND phase.active = true
    AND ticket.id_status = 1
    AND dp.active = true
    AND department.id_department_core = ${department}
    `)

    return total_tickets_nao_iniciado.rows[0].count
  }

  async tickets_nao_iniciados(department, id_company) {
    const tickets_nao_iniciado = await this.database.raw(`
    SELECT ticket.id, ticket.id_phase
    FROM ticket
    LEFT JOIN phase on phase.id = ticket.id_phase
    LEFT JOIN department_phase dp ON dp.id_phase = phase.id
    LEFT JOIN department ON department.id = dp.id_department
    WHERE ticket.id_company = '${id_company}'
    AND phase.active = true
    AND dp.active = true
    AND ticket.id_status = 1
    AND department.id_department_core = ${department}
    `)
    return tickets_nao_iniciado.rows
  }

  async total_tickets_nao_iniciados_em_dia(department, id_company) {
    const total_tickets_nao_iniciados_em_dia = await this.database.raw(`
    SELECT COUNT(ticket.id)
    FROM ticket
    LEFT JOIN phase on phase.id = ticket.id_phase
    LEFT JOIN department_phase dp ON dp.id_phase = phase.id
    LEFT JOIN department ON department.id = dp.id_department
    LEFT JOIN ticket_sla_control tsc ON tsc.id_ticket = ticket.id AND tsc.id_phase = phase.id
    WHERE ticket.id_company = '${id_company}'
    AND phase.active = true
    AND dp.active = true
    AND ticket.id_status = 1
    AND department.id_department_core = ${department}
    AND tsc.id_sla_type = 1
    AND tsc.id_sla_status = 1
    `)
    return total_tickets_nao_iniciados_em_dia.rows[0].count
  }

  async total_tickets_nao_iniciados_atrasado(department, id_company) {
    const total_tickets_nao_iniciados_atrasado = await this.database.raw(`
    SELECT COUNT(ticket.id)
    FROM ticket
    LEFT JOIN phase on phase.id = ticket.id_phase
    LEFT JOIN department_phase dp ON dp.id_phase = phase.id
    LEFT JOIN department ON department.id = dp.id_department
    LEFT JOIN ticket_sla_control tsc ON tsc.id_ticket = ticket.id AND tsc.id_phase = phase.id
    WHERE ticket.id_company = '${id_company}'
    AND phase.active = true
    AND dp.active = true
    AND ticket.id_status = 1
    AND department.id_department_core = ${department}
    AND tsc.id_sla_type = 1
    AND tsc.id_sla_status = 2
    `)
    return total_tickets_nao_iniciados_atrasado.rows[0].count
  }

  async tickets_iniciados(department, id_company) {
    const tickets_iniciados = await this.database.raw(`
    SELECT ticket.id, ticket.id_phase
    FROM ticket
    LEFT JOIN phase on phase.id = ticket.id_phase
    LEFT JOIN department_phase dp ON dp.id_phase = phase.id
    LEFT JOIN department ON department.id = dp.id_department
    WHERE ticket.id_company = '${id_company}'
    AND phase.active = true
    AND dp.active = true
    AND ticket.id_status = 2
    AND ticket.start_time is not null
    AND department.id_department_core = ${department}
    `)
    return tickets_iniciados.rows
  }

  async total_tickets_iniciados(department, id_company) {
    const total_tickets_iniciados = await this.database.raw(`
    SELECT COUNT(ticket.id)
    FROM ticket
    LEFT JOIN phase on phase.id = ticket.id_phase
    LEFT JOIN department_phase dp ON dp.id_phase = phase.id
    LEFT JOIN department ON department.id = dp.id_department
    WHERE ticket.id_company = '${id_company}'
    AND phase.active = true
    AND dp.active = true
    AND ticket.id_status = 2
    AND department.id_department_core = ${department}
    `)
    return total_tickets_iniciados.rows[0].count
  }

  async total_tickets_iniciados_sem_resposta_emdia(department, id_company) {
    const total_tickets_iniciados_emdia = await this.database.raw(`
    SELECT COUNT(ticket.id)
    FROM ticket
    LEFT JOIN phase on phase.id = ticket.id_phase
    LEFT JOIN department_phase dp ON dp.id_phase = phase.id
    LEFT JOIN department ON department.id = dp.id_department
    LEFT JOIN ticket_sla_control tsc ON tsc.id_ticket = ticket.id AND tsc.id_phase = phase.id
    WHERE ticket.id_company = '${id_company}'
    AND phase.active = true
    AND dp.active = true
    AND ticket.id_status = 2
    AND department.id_department_core = ${department}
    AND tsc.id_sla_type = 2
    AND tsc.id_sla_status = 1
    AND tsc.interaction_time is null
    `)
    return total_tickets_iniciados_emdia.rows[0].count
  }

  async total_tickets_iniciados_sem_resposta_atrasado(department, id_company) {
    const total_tickets_iniciados_sem_resposta_atrasado = await this.database.raw(`
    SELECT COUNT(ticket.id)
    FROM ticket
    LEFT JOIN phase on phase.id = ticket.id_phase
    LEFT JOIN department_phase dp ON dp.id_phase = phase.id
    LEFT JOIN department ON department.id = dp.id_department
    LEFT JOIN ticket_sla_control tsc ON tsc.id_ticket = ticket.id AND tsc.id_phase = phase.id
    WHERE ticket.id_company = '${id_company}'
    AND phase.active = true
    AND dp.active = true
    AND ticket.id_status = 2
    AND department.id_department_core = ${department}
    AND tsc.id_sla_type = 2
    AND tsc.id_sla_status = 2
    AND tsc.interaction_time is null
    `)
    return total_tickets_iniciados_sem_resposta_atrasado.rows[0].count
  }

  
  async total_tickets_respondido_emdia(department, id_company) {
    const total_tickets_respondido_emdia = await this.database.raw(`
    SELECT COUNT(ticket.id)
    FROM ticket
    LEFT JOIN phase on phase.id = ticket.id_phase
    LEFT JOIN department_phase dp ON dp.id_phase = phase.id
    LEFT JOIN department ON department.id = dp.id_department
    LEFT JOIN ticket_sla_control tsc ON tsc.id_ticket = ticket.id AND tsc.id_phase = phase.id
    WHERE ticket.id_company = '${id_company}'
    AND phase.active = true
    AND dp.active = true
    AND ticket.id_status = 2
    AND department.id_department_core = ${department}
    AND tsc.id_sla_type = 3
    AND tsc.id_sla_status = 1
    AND tsc.interaction_time is null
    `)
    return total_tickets_respondido_emdia.rows[0].count
  }

  async total_tickets_respondido_atrasado(department, id_company) {
    const total_tickets_respondido_atrasado = await this.database.raw(`
    SELECT COUNT(ticket.id)
    FROM ticket
    LEFT JOIN phase on phase.id = ticket.id_phase
    LEFT JOIN department_phase dp ON dp.id_phase = phase.id
    LEFT JOIN department ON department.id = dp.id_department
    LEFT JOIN ticket_sla_control tsc ON tsc.id_ticket = ticket.id AND tsc.id_phase = phase.id
    WHERE ticket.id_company = '${id_company}'
    AND phase.active = true
    AND dp.active = true
    AND ticket.id_status = 2
    AND department.id_department_core = ${department}
    AND tsc.id_sla_type = 3
    AND tsc.id_sla_status = 2
    `)
    return total_tickets_respondido_atrasado.rows[0].count
  }


  async total_tickets_concluidos_emdia(department, id_company) {
    const total_tickets_concluidos_emdia = await this.database.raw(`
    SELECT COUNT(ticket.id)
    FROM ticket
    LEFT JOIN phase on phase.id = ticket.id_phase
    LEFT JOIN department_phase dp ON dp.id_phase = phase.id
    LEFT JOIN department ON department.id = dp.id_department
    LEFT JOIN ticket_sla_control tsc ON tsc.id_ticket = ticket.id AND tsc.id_phase = phase.id
    WHERE ticket.id_company = '${id_company}'
    AND phase.active = true
    AND dp.active = true
    AND ticket.id_status = 3
    AND department.id_department_core = ${department}
    AND tsc.id_sla_type = 3
    AND tsc.id_sla_status = 1
    `)
    return total_tickets_concluidos_emdia.rows[0].count
  }

  async total_tickets_concluidos_atrasado(department, id_company) {
    const total_tickets_concluidos_atrasado = await this.database.raw(`
    SELECT COUNT(ticket.id)
    FROM ticket
    LEFT JOIN phase on phase.id = ticket.id_phase
    LEFT JOIN department_phase dp ON dp.id_phase = phase.id
    LEFT JOIN department ON department.id = dp.id_department
    LEFT JOIN ticket_sla_control tsc ON tsc.id_ticket = ticket.id AND tsc.id_phase = phase.id
    WHERE ticket.id_company = '${id_company}'
    AND phase.active = true
    AND dp.active = true
    AND ticket.id_status = 3
    AND department.id_department_core = ${department}
    AND tsc.id_sla_type = 3
    AND tsc.id_sla_status = 2
    `)
    return total_tickets_concluidos_atrasado.rows[0].count
  }
}
