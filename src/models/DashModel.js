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
    WHERE ticket.id_company = ${id_company}
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
    WHERE ticket.id_company = ${id_company}
    AND phase.active = true
    AND ticket.id_status = 3
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
    WHERE ticket.id_company = ${id_company}
    AND phase.active = true
    AND ticket.id_status = 1
    AND department.id_department_core = ${department}
    `)

    return total_tickets_nao_iniciado.rows[0].count
  }

  async tickets_nao_iniciado(department, id_company) {
    const tickets_nao_iniciado = await this.database.raw(`
    SELECT ticket.id, ticket.id_phase
    FROM ticket
    LEFT JOIN phase on phase.id = ticket.id_phase
    LEFT JOIN department_phase dp ON dp.id_phase = phase.id
    LEFT JOIN department ON department.id = dp.id_department
    WHERE ticket.id_company = ${id_company}
    AND phase.active = true
    AND ticket.id_status = 1
    AND department.id_department_core = ${department}
    `)
    return tickets_nao_iniciado.rows
  }
}
