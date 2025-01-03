const tableName = "phase";

export default class PhaseModel {
  constructor(database = {}, logger = {}) {
    this.database = database;
    this.logger = logger;
  }
  async createPhase(obj) {
    try {
      return await this.database(tableName).returning(["id"]).insert(obj);
    } catch (err) {
      this.logger.error(err, "Error when create phase.");
      return err;
    }
  }

  async getPhaseById(id_phase, id_company) {
    try {
      return await this.database(tableName)
        .select({
          id: "phase.id",
          id_unit_of_time: "phase.id_unit_of_time",
          unit_of_time: "unit_of_time.name",
          emoji: "phase.icon",
          name: "phase.name",
          sla_time: "phase.sla_time",
          responsible_notify_sla: "phase.responsible_notify_sla",
          supervisor_notify_sla: "phase.supervisor_notify_sla",
          form: "phase.form",
          id_form_template: "phase.id_form_template",
          active: "phase.active",
          order: "phase.order",
          created_at: "phase.created_at",
          updated_at: "phase.updated_at",
          customer: "phase.notification_customer",
          admin: "phase.notification_admin",
          responsible: "phase.notification_responsible",
          separate: "phase.notification_separate",
          department_can_create_protocol:
            "phase.department_can_create_protocol",
          department_can_create_ticket: "phase.department_can_create_ticket",
          create_protocol: "phase.create_protocol",
          create_ticket: "phase.create_ticket",
          visible_new_ticket: "phase.visible_new_ticket",
          id_department: "department.id_department_core",
        })
        .leftJoin("unit_of_time", "unit_of_time.id", "phase.id_unit_of_time")
        .leftJoin("department_phase", "department_phase.id_phase", "phase.id")
        .leftJoin(
          "department",
          "department.id",
          "department_phase.id_department"
        )
        .where("phase.id", id_phase)
        .andWhere("department_phase.active", true)
        .andWhere("phase.id_company", id_company);
    } catch (err) {
      this.logger.error(err, "Error when catch phase and tickets by id phase.");
      return err;
    }
  }

  async getPhase(id, id_company) {
    try {
      return await this.database(tableName)
        .where("id", id)
        .andWhere("id_company", id_company);
    } catch (err) {
      this.logger.error(err, "Error when catch phase by id => ");
      return err;
    }
  }

  async createResponsiblePhase(obj) {
    try {
      return await this.database("responsible_phase")
        .returning(["id"])
        .insert(obj);
    } catch (err) {
      this.logger.error(err, "Error when create responsible phase => ");
      return err;
    }
  }

  async createNotifyPhase(obj) {
    try {
      return await this.database("notify_phase").returning(["id"]).insert(obj);
    } catch (err) {
      this.logger.error(err, "Error when create notify phase.");
      return err;
    }
  }

  async linkedDepartment(obj) {
    try {
      await this.database("department_phase")
        .update("active", false)
        .where("id_phase", obj.id_phase);
      return await this.database("department_phase")
        .returning(["id"])
        .insert(obj);
    } catch (err) {
      this.logger.error(err, "Error when linked department with phase.");
      return err;
    }
  }

  async selectLinkedDepartment(phase_id) {
    try {
      return await this.database("department_phase")
        .where("id_phase", phase_id)
        .andWhere("active", true);
    } catch (err) {
      this.logger.error(err, "Error when remove linked.");
      return err;
    }
  }

  async getNotifiedPhase(phase_id) {
    try {
      return await this.database("phase")
        .select({
          phase: "phase.id",
          phase_description: "phase.name",
          id_user_core: "users.id_users",
          id_user: "users.id",
          email: "email.email",
          id_email: "email.id",
        })
        .leftJoin("notify_phase", "notify_phase.id_phase", "phase.id")
        .leftJoin("users", "users.id", "notify_phase.id_user")
        .leftJoin("email", "email.id", "notify_phase.id_email")
        .where("phase.id", phase_id);
    } catch (err) {
      this.logger.error(err, "Error when get notified phase.");
      return err;
    }
  }

  async getDepartmentPhase(id_phase) {
    try {
      return await this.database("department_phase")
        .select({ id_department: "department.id_department_core" })
        .leftJoin(
          "department",
          "department.id",
          "department_phase.id_department"
        )
        .where("department_phase.id_phase", id_phase)
        .andWhere("department_phase.active", true);
    } catch (err) {
      this.logger.error(err, "Error when catch department phase.");
      return err;
    }
  }

  async getPhasesByDepartmentID(id_department) {
    try {
      return await this.database("department_phase")
        .select({
          id: "phase.id",
          name: "phase.name",
          form: "phase.form",
          icon: "phase.icon",
          id_form_template: "phase.id_form_template",
          sla_time: "phase.sla_time",
          department_can_create_protocol:
            "phase.department_can_create_protocol",
          department_can_create_ticket: "phase.department_can_create_ticket",
        })
        .leftJoin("phase", "phase.id", "department_phase.id_phase")
        .where("department_phase.id_department", id_department)
        .andWhere("phase.active", true)
        .andWhere("department_phase.active", true);
    } catch (err) {
      this.logger.error(err, "Error when catch department id");
      return err;
    }
  }

  async disablePhaseTicket(id_ticket) {
    try {
      return await this.database("phase_ticket")
        .update({ active: "false" })
        .where("id_ticket", id_ticket);
    } catch (err) {
      this.logger.error(err, "Error when disable phase ticket linked.");
      return err;
    }
  }

  async getAllPhase(id_company, enable) {
    try {
      return await this.database(tableName)
        .select([
          "id",
          "id_unit_of_time",
          "icon as emoji",
          "name",
          "sla_time",
          "id_form_template",
          "active",
          "order",
          "created_at",
          "updated_at",
          "phase.visible_new_ticket",
          "phase.notification_customer as customer",
          "phase.notification_admin as admin",
          "phase.notification_responsible as responsible",
          "phase.notification_separate as separate",
          "phase.department_can_create_protocol",
          "phase.department_can_create_ticket",
          "phase.create_protocol",
          "phase.create_ticket",
        ])
        .where("id_company", id_company)
        .andWhere("phase.active", enable)
        .orderBy("order", "asc");
    } catch (err) {
      return err;
    }
  }

  
  async getPhasesForCache() {
    try {
      return await this.database(tableName)
        .select([
          "id",
          "id_unit_of_time",
          "icon as emoji",
          "name",
          "sla_time",
          "id_form_template",
          "active",
          "order",
          "created_at",
          "updated_at",
          "phase.visible_new_ticket",
          "phase.notification_customer as customer",
          "phase.notification_admin as admin",
          "phase.notification_responsible as responsible",
          "phase.notification_separate as separate",
          "phase.department_can_create_protocol",
          "phase.department_can_create_ticket",
          "phase.create_protocol",
          "phase.create_ticket",
        ])
        .orderBy("order", "asc");
    } catch (err) {
      return err;
    }
  }


  async getAllPhasesByDepartmentID(id_department, id_company, enable) {
    try {
      return await this.database("department_phase")
        .select([
          "phase.id",
          "phase.icon as emoji",
          "phase.name",
          "phase.id_form_template",
          "phase.active",
          "phase.order",
          "phase.created_at",
          "phase.updated_at",
          "phase.visible_new_ticket",
          "phase.notification_customer as customer",
          "phase.notification_admin as admin",
          "phase.notification_responsible as responsible",
          "phase.notification_separate as separate",
          "phase.department_can_create_protocol",
          "phase.department_can_create_ticket",
          "phase.create_protocol",
          "phase.create_ticket",
          "department.id_department_core as department",
          "phase.form",
        ])
        .leftJoin("phase", "phase.id", "department_phase.id_phase")
        .leftJoin(
          "department",
          "department.id",
          "department_phase.id_department"
        )
        .where("department.id_department_core", id_department)
        .andWhere("department_phase.active", true)
        .andWhere("phase.active", enable)
        .andWhere("department.id_company", id_company)
        .orderBy("phase.order", "asc");
    } catch (err) {
      this.logger.error(err, "Error when catch department id.");
      return err;
    }
  }

  async updatePhase(obj, id_phase, id_company) {
    try {
      return await this.database(tableName)
        .update(obj)
        .where("id", id_phase)
        .andWhere("id_company", id_company);
    } catch (err) {
      this.logger.error(err, "Error update phase.");
      return err;
    }
  }

  async delResponsiblePhase(id_phase) {
    try {
      return await this.database("responsible_phase")
        .where("id_phase", id_phase)
        .del();
    } catch (err) {
      this.logger.error(err, "Error when get responsible Ticket.");
      return err;
    }
  }

  async delNotifyPhase(id_phase) {
    try {
      return await this.database("notify_phase")
        .where("id_phase", id_phase)
        .del();
    } catch (err) {
      this.logger.error(err, "Error when get responsible Ticket.");
      return err;
    }
  }

  async getPhasesIN(phases, department, company) {
    try {
      return await this.database(tableName)
        .leftJoin("department_phase", "department_phase.id_phase", "phase.id")
        .leftJoin(
          "department",
          "department.id",
          "department_phase.id_department"
        )
        .whereIn("phase.id", phases)
        .andWhere("department_phase.active", true)
        .andWhere("department.id_department_core", department)
        .andWhere("phase.id_company", company);
    } catch (err) {
      this.logger.error(err, "Erro ao captar as ordens dos tickets.");
      return err;
    }
  }

  async dash(department, id_company) {
    try {
      const total_fases = await this.database.raw(`
    SELECT COUNT(phase.id) 
    FROM department_phase 
    LEFT JOIN department ON department.id = department_phase.id_department 
    LEFT JOIN phase ON phase.id = department_phase.id_phase 
    WHERE department_phase.active = true 
    AND phase.active = true 
    AND department.id_department_core = ${department} 
    AND phase.id_company = '${id_company}'
    `);

      const total_tickets = await this.database.raw(`
    SELECT COUNT(ticket.id) FROM ticket
    LEFT JOIN phase_ticket ON phase_ticket.id_ticket = ticket.id
    LEFT JOIN phase ON phase.id = phase_ticket.id_phase
    LEFT JOIN department_phase ON department_phase.id_phase = phase.id
    LEFT JOIN department ON department.id = department_phase.id_department
    WHERE department.id_department_core = ${department} 
    AND phase.id_company = '${id_company}'
    AND phase.active = true
    AND department_phase.active = true
    AND phase_ticket.active = true;
    `);

      const tickets = await this.database.raw(`
    SELECT ticket.id, phase_ticket.id_phase, ticket.id_status FROM ticket
    LEFT JOIN phase_ticket ON phase_ticket.id_ticket = ticket.id
    LEFT JOIN phase ON phase.id = phase_ticket.id_phase
    LEFT JOIN department_phase ON department_phase.id_phase = phase.id
    LEFT JOIN department ON department.id = department_phase.id_department
    WHERE department.id_department_core = ${department} 
    AND phase.id_company = '${id_company}'
    AND phase.active = true
    AND department_phase.active = true
    AND phase_ticket.active = true;
 `);

      const total_tickets_fechados = await this.database.raw(`   
    SELECT COUNT(ticket.id) FROM ticket
    LEFT JOIN phase_ticket ON phase_ticket.id_ticket = ticket.id
    LEFT JOIN phase ON phase.id = phase_ticket.id_phase
    LEFT JOIN department_phase ON department_phase.id_phase = phase.id
    LEFT JOIN department ON department.id = department_phase.id_department
    WHERE department.id_department_core = ${department} 
    AND phase.id_company = '${id_company}'
    AND phase.active = true
    AND department_phase.active = true
    AND phase_ticket.active = true
    AND ticket.closed = true
    AND ticket.id_status = 3
    `);

      const phases = await this.database.raw(`   
    SELECT phase.id FROM phase
    LEFT JOIN department_phase ON department_phase.id_phase = phase.id
    LEFT JOIN department ON department.id = department_phase.id_department
    WHERE department.id_department_core = ${department} 
    AND phase.id_company = '${id_company}'
    AND phase.active = true
    AND department_phase.active = true
    `);

      return {
        total_fases: total_fases.rows[0].count,
        total_tickets: total_tickets.rows[0].count,
        total_tickets_fechados: total_tickets_fechados.rows[0].count,
        tickets: tickets.rows,
        phases: phases.rows,
        // total_tickets_atendimento: total_tickets_atendimento.rows[0].count,
      };
    } catch (err) {
      this.logger.error(err, "dashs");
      return false;
    }
  }

  async dashForCustomer(department, id_company, customer) {
    try {
      const total_fases = await this.database.raw(`
    SELECT COUNT(phase.id) 
    FROM department_phase 
    LEFT JOIN department ON department.id = department_phase.id_department 
    LEFT JOIN phase ON phase.id = department_phase.id_phase 
    WHERE department_phase.active = true 
    AND phase.active = true 
    AND department.id_department_core = ${department} 
    AND phase.id_company = '${id_company}'
    `);

      const total_tickets = await this.database.raw(`
    SELECT COUNT(ticket.id) FROM ticket
    LEFT JOIN phase_ticket ON phase_ticket.id_ticket = ticket.id
    LEFT JOIN phase ON phase.id = phase_ticket.id_phase
    LEFT JOIN department_phase ON department_phase.id_phase = phase.id
    LEFT JOIN department ON department.id = department_phase.id_department
    LEFT JOIN customer ON customer.id_ticket = ticket.id
    WHERE department.id_department_core = ${department} 
    AND phase.id_company = '${id_company}'
    AND phase.active = true
    AND department_phase.active = true
    AND phase_ticket.active = true
    AND customer.crm_contact_id = ${customer};
    `);

      const tickets = await this.database.raw(`
    SELECT ticket.id, phase_ticket.id_phase, ticket.id_status FROM ticket
    LEFT JOIN phase_ticket ON phase_ticket.id_ticket = ticket.id
    LEFT JOIN phase ON phase.id = phase_ticket.id_phase
    LEFT JOIN department_phase ON department_phase.id_phase = phase.id
    LEFT JOIN department ON department.id = department_phase.id_department
    LEFT JOIN customer ON customer.id_ticket = ticket.id
    WHERE department.id_department_core = ${department} 
    AND phase.id_company = '${id_company}'
    AND phase.active = true
    AND department_phase.active = true
    AND phase_ticket.active = true
    AND customer.crm_contact_id = ${customer};
 `);

      const total_tickets_fechados = await this.database.raw(`   
    SELECT COUNT(ticket.id) FROM ticket
    LEFT JOIN phase_ticket ON phase_ticket.id_ticket = ticket.id
    LEFT JOIN phase ON phase.id = phase_ticket.id_phase
    LEFT JOIN department_phase ON department_phase.id_phase = phase.id
    LEFT JOIN department ON department.id = department_phase.id_department
    LEFT JOIN customer ON customer.id_ticket = ticket.id
    WHERE department.id_department_core = ${department} 
    AND phase.id_company = '${id_company}'
    AND phase.active = true
    AND department_phase.active = true
    AND phase_ticket.active = true
    AND ticket.closed = true
    AND ticket.id_status = 3
    AND customer.crm_contact_id = ${customer};
    `);

      const phases = await this.database.raw(`   
    SELECT phase.id FROM phase
    LEFT JOIN department_phase ON department_phase.id_phase = phase.id
    LEFT JOIN department ON department.id = department_phase.id_department
    WHERE department.id_department_core = ${department} 
    AND phase.id_company = '${id_company}'
    AND phase.active = true
    AND department_phase.active = true
    `);

      return {
        total_fases: total_fases.rows[0].count,
        total_tickets: total_tickets.rows[0].count,
        total_tickets_fechados: total_tickets_fechados.rows[0].count,
        tickets: tickets.rows,
        phases: phases.rows,
        // total_tickets_atendimento: total_tickets_atendimento.rows[0].count,
      };
    } catch (err) {
      this.logger.error(err, "dashs");
      return false;
    }
  }

  async filter(department, id_company, customer) {
    if (customer) {
      const tickets = await this.database.raw(`
      SELECT ticket.id, phase_ticket.id_phase, ticket.id_status FROM ticket
      LEFT JOIN phase_ticket ON phase_ticket.id_ticket = ticket.id
      LEFT JOIN phase ON phase.id = phase_ticket.id_phase
      LEFT JOIN department_phase ON department_phase.id_phase = phase.id
      LEFT JOIN department ON department.id = department_phase.id_department
      LEFT JOIN customer ON customer.id_ticket = ticket.id
      WHERE department.id_department_core = ${department} 
      AND phase.id_company = '${id_company}'
      AND phase.active = true
      AND department_phase.active = true
      AND phase_ticket.active = true
      AND customer.crm_contact_id = ${customer};
   `);
      return tickets.rows;
    } else {
      const tickets = await this.database.raw(`
      SELECT ticket.id, phase_ticket.id_phase, ticket.id_status FROM ticket
      LEFT JOIN phase_ticket ON phase_ticket.id_ticket = ticket.id
      LEFT JOIN phase ON phase.id = phase_ticket.id_phase
      LEFT JOIN department_phase ON department_phase.id_phase = phase.id
      LEFT JOIN department ON department.id = department_phase.id_department
      WHERE department.id_department_core = ${department} 
      AND phase.id_company = '${id_company}'
      AND phase.active = true
      AND department_phase.active = true
      AND phase_ticket.active = true;
   `);
      return tickets.rows;
    }
  }

  async getFormularios(id_phase, customer = false) {
    try {
      const id_form_template = await this.database("phase")
        .select("id_form_template")
        .where("id", id_phase);

      if (id_form_template) {
        let result;
        if (customer) {
          result = await this.database("phase_ticket")
            .select("id_form")
            .leftJoin(
              "customer",
              "customer.id_ticket",
              "phase_ticket.id_ticket"
            )
            .where("id_phase", id_phase)
            .andWhere("active", true)
            .andWhere("customer.crm_contact_id", customer);
        } else {
          result = await this.database("phase_ticket")
            .select("id_form")
            .where("id_phase", id_phase)
            .andWhere("active", true);
        }

        return { forms: result, id_form: id_form_template };
      }
      return false;
    } catch (err) {
      this.logger.error(err, "Error get formularios ===>");
      return err;
    }
  }
}
