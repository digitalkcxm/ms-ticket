const database = require("../config/database/database");
const moment = require("moment");
const { leftJoin } = require("../config/database/database");
const tableName = "ticket";
class TicketModel {
  async create(obj) {
    try {
      return await database(tableName).returning(["id"]).insert(obj);
    } catch (err) {
      console.log("Error 1111 when create ticket =>", err);
      return err;
    }
  }
  async createPhaseTicket(obj) {
    try {
      return await database("phase_ticket").returning(["id"]).insert(obj);
    } catch (err) {
      console.log("Error when create phase ticket =>", err);
      return err;
    }
  }

  async createResponsibleTicket(obj) {
    try {
      return await database("responsible_ticket").returning(["id"]).insert(obj);
    } catch (err) {
      console.log("Error when create responsible ticket =>", err);
      return err;
    }
  }
  async getTicketById(id, id_company) {
    try {
      return await database(tableName)
        .select({
          id: `${tableName}.id`,
          id_seq: `${tableName}.id_seq`,
          id_company: `${tableName}.id_company`,
          phase_id: "phase_ticket.id_phase",
          phase: "phase.name",
          id_user: "users.id_users_core",
          name: "users.name",
          sla_time: "phase.sla_time",
          id_unit_of_time: "phase.id_unit_of_time",
          form: "phase.form",
          closed: `${tableName}.closed`,
          id_form: `${tableName}.id_form`,
          department_origin: `${tableName}.department_origin`,
          created_at: `${tableName}.created_at`,
          updated_at: `${tableName}.updated_at`,
          start_ticket: "responsible_ticket.start_ticket",
        })
        .leftJoin("users", "users.id", `${tableName}.id_user`)
        .leftJoin("phase_ticket", "phase_ticket.id_ticket", `${tableName}.id`)
        .leftJoin("phase", "phase.id", "phase_ticket.id_phase")
        .leftJoin(
          "responsible_ticket",
          "responsible_ticket.id_ticket",
          "ticket.id"
        )
        .where(`${tableName}.id`, id)
        .andWhere(`${tableName}.id_company`, id_company)
        .orderBy("phase_ticket.id", "desc")
        .limit(1);
    } catch (err) {
      console.log("Error when get ticket by id => ", err);
      return err;
    }
  }
  async getTicketByIdSeq(id_seq, id_company) {
    try {
      return await database(tableName)
        .select({
          id: `${tableName}.id`,
          id_seq: `${tableName}.id_seq`,
          id_company: `${tableName}.id_company`,
          phase_id: "phase_ticket.id_phase",
          phase: "phase.name",
          id_user: "users.id_users_core",
          name: "users.name",
          sla_time: "phase.sla_time",
          id_unit_of_time: "phase.id_unit_of_time",
          form: "phase.form",
          closed: `${tableName}.closed`,
          id_form: `${tableName}.id_form`,
          department_origin: `${tableName}.department_origin`,
          created_at: `${tableName}.created_at`,
          updated_at: `${tableName}.updated_at`,
          start_ticket: "responsible_ticket.start_ticket",
        })
        .leftJoin("users", "users.id", `${tableName}.id_user`)
        .leftJoin("phase_ticket", "phase_ticket.id_ticket", `${tableName}.id`)
        .leftJoin("phase", "phase.id", "phase_ticket.id_phase")
        .leftJoin(
          "responsible_ticket",
          "responsible_ticket.id_ticket",
          "ticket.id"
        )
        .where(`${tableName}.id_seq`, id_seq)
        .andWhere(`${tableName}.id_company`, id_company)
        .orderBy("phase_ticket.id", "desc")
        .limit(1);
    } catch (err) {
      console.log("Error when get ticket by id => ", err);
      return err;
    }
  }

  async getAllTickets(id_company, obj) {
    console.log("TicketModel -> getAllTickets -> id_company", id_company);
    try {
      let stringWhere = `${tableName}.id_company = '${id_company}'`;

      if (obj.department && obj.department.length > 0) {
        stringWhere =
          stringWhere +
          ` AND department.id_department_core in (${obj.department}) `;
      }
      if (obj.users && obj.users.length > 0) {
        stringWhere =
          stringWhere + ` AND users.id_users_core in (${obj.users}) `;
      }
      if (obj.closed && obj.closed.length > 0) {
        stringWhere = stringWhere + ` AND ticket.closed in (${obj.closed}) `;
      }
      if (obj.sla && obj.sla.length > 0) {
        stringWhere = stringWhere + ` AND ticket.sla in (${obj.sla}) `;
      }
      if (obj.range && obj.range.length > 0) {
        stringWhere =
          stringWhere +
          `AND ticket.created_at >= '${obj.range[0]}' AND ticket.created_at <= '${obj.range[1]}'`;
      }

      return await database(tableName)
        .select({
          id: `${tableName}.id`,
          id_seq: `${tableName}.id_seq`,
          ids_crm: `${tableName}.ids_crm`,
          id_customer: `${tableName}.id_customer`,
          id_protocol: `${tableName}.id_protocol`,
          id_phase: "phase.id",
          phase: "phase.name",
          id_user: "users.id_users_core",
          name: "users.name",
          sla_time: "phase.sla_time",
          id_unit_of_time: "phase.id_unit_of_time",
          form: "phase.form",
          closed: `${tableName}.closed`,
          id_form: `${tableName}.id_form`,
          department_origin: `${tableName}.department_origin`,
          created_at: `${tableName}.created_at`,
          updated_at: `${tableName}.updated_at`,
        })
        .leftJoin(
          "responsible_ticket",
          "responsible_ticket.id_ticket",
          `${tableName}.id`
        )
        .leftJoin("users", "users.id", "responsible_ticket.id_user")
        .leftJoin("phase_ticket", "phase_ticket.id_ticket", `${tableName}.id`)
        .leftJoin("phase", "phase.id", "phase_ticket.id_phase")
        .leftJoin("department_phase", "department_phase.id_phase", "phase.id")
        .leftJoin(
          "department",
          "department.id",
          "department_phase.id_department"
        )
        .whereRaw(stringWhere);
    } catch (err) {
      console.log("Error when get ticket by id => ", err);
      return err;
    }
  }

  async getTypeAttachments(type) {
    try {
      return await database("type_attachments").where("name", type);
    } catch (err) {
      console.log("Error when get type attachments by id => ", err);
      return err;
    }
  }

  async updateTicket(obj, id, id_company) {
    try {
      return await database(tableName)
        .update(obj)
        .where("id", id)
        .andWhere("id_company", id_company);
    } catch (err) {
      console.log("Update ticket => ", err);
      return err;
    }
  }

  async delResponsibleTicket(id_ticket) {
    try {
      return await database("responsible_ticket")
        .andWhere("id_ticket", id_ticket)
        .del();
    } catch (err) {
      console.log("Error when get responsible Ticket =>", err);
      return err;
    }
  }

  async closedTicket(id_ticket) {
    try {
      return await database(tableName)
        .returning(["id"])
        .update({
          closed: true,
          updated_at: moment().format(),
        })
        .where("id", id_ticket);
    } catch (err) {
      console.log("Error when update Ticket to closed");
      return err;
    }
  }

  async getAllTicketWhitoutCompanyId() {
    try {
      return await database(tableName).select().where("sla", false);
    } catch (err) {
      console.log("Error when catch all ticket =>", err);
      return err;
    }
  }

  async updateSlaTicket(obj, id) {
    try {
      return await database(tableName).update(obj).where("id", id);
    } catch (err) {
      console.log("Error when update sla ticket =>", err);
      return err;
    }
  }

  async getAllResponsibleTicket(id_ticket) {
    try {
      return await database("responsible_ticket")
        .select({
          id_ticket: "responsible_ticket.id_ticket",
          id_user: "responsible_ticket.id_user",
          id_users_core: "users.id_users_core",
          id_email: "responsible_ticket.id_email",
          id_type_of_responsible: "responsible_ticket.id_type_of_responsible",
        })
        .leftJoin("users", "users.id", "responsible_ticket.id_user")
        .where("id_ticket", id_ticket);
    } catch (err) {
      console.log("Error when get all responsible ticket => ", err);
      return err;
    }
  }

  async getCountResponsibleTicket(id_company, obj) {
    try {
      let stringWhere = `users.id_company = '${id_company}'`;

      if (obj.department && obj.department.length > 0) {
        stringWhere =
          stringWhere +
          ` AND department.id_department_core in (${obj.department}) `;
      }
      if (obj.users && obj.users.length > 0) {
        stringWhere =
          stringWhere + ` AND users.id_users_core in (${obj.users}) `;
      }
      if (obj.closed && obj.closed.length > 0) {
        stringWhere = stringWhere + ` AND ticket.closed in (${obj.closed}) `;
      }
      if (obj.range && obj.range.length > 0) {
        stringWhere =
          stringWhere +
          `AND ticket.created_at >= '${obj.range[0]}' AND ticket.created_at <= '${obj.range[1]}'`;
      }
      return await database("ticket")
        .select("users.id_users_core as id_user")
        .count("ticket.id as count")
        .leftJoin(
          "responsible_ticket",
          "responsible_ticket.id_ticket",
          "ticket.id"
        )
        .leftJoin("users", "users.id", "responsible_ticket.id_user")
        .leftJoin("phase_ticket", "phase_ticket.id_ticket", `ticket.id`)
        .leftJoin("phase", "phase.id", "phase_ticket.id_phase")
        .leftJoin("department_phase", "department_phase.id_phase", "phase.id")
        .leftJoin(
          "department",
          "department.id",
          "department_phase.id_department"
        )
        .whereRaw(stringWhere)
        .groupBy("users.id_users_core");
    } catch (err) {
      console.log("Error when get all responsible ticket => ", err);
      return err;
    }
  }

  async getTicketByPhase(id_phase) {
    try {
      return await database("phase_ticket")
        .select({
          id: "ticket.id",
          id_seq: "ticket.id_seq",
          ids_crm: "ticket.ids_crm",
          id_user: "users.id_users_core",
          id_customer: "ticket.id_customer",
          id_protocol: "ticket.id_protocol",
          closed: "ticket.closed",
          sla: "ticket.sla",
          id_form: `ticket.id_form`,
          department_origin: `ticket.department_origin`,
          created_at: "ticket.created_at",
          updated_at: "ticket.updated_at",
        })
        .leftJoin("ticket", "ticket.id", "phase_ticket.id_ticket")
        .leftJoin("users", "users.id", "ticket.id_user")
        .where("phase_ticket.id_phase", id_phase)
        .andWhere("phase_ticket.active", true);
    } catch (err) {
      console.log("Error when get Ticket by phase =>", err);
      return err;
    }
  }
  async getTicketByPhaseAndStatus(id_phase, status) {
    try {
      let newStatus;
      typeof status ? (newStatus = JSON.parse(status)) : (newStatus = status);

      return await database("phase_ticket")
        .select({
          id: "ticket.id",
          id_seq: "ticket.id_seq",
          ids_crm: "ticket.ids_crm",
          id_user: "users.id_users_core",
          id_customer: "ticket.id_customer",
          id_protocol: "ticket.id_protocol",
          closed: "ticket.closed",
          id_form: `ticket.id_form`,
          department_origin: `ticket.department_origin`,
          created_at: "ticket.created_at",
          updated_at: "ticket.updated_at",
        })
        .leftJoin("ticket", "ticket.id", "phase_ticket.id_ticket")
        .leftJoin("users", "users.id", "ticket.id_user")
        .whereIn("ticket.closed", newStatus)
        .andWhere("phase_ticket.id_phase", id_phase)
        .andWhere("phase_ticket.active", true);
    } catch (err) {
      console.log("Error when get Ticket by phase =>", err);
      return err;
    }
  }

  async countTicket(id_phase, status) {
    const result = await database("phase_ticket")
      .count("ticket.id")
      .leftJoin("ticket", "ticket.id", "phase_ticket.id_ticket")
      .leftJoin("users", "users.id", "ticket.id_user")
      .where("phase_ticket.id_phase", id_phase)
      .andWhere("phase_ticket.active", true)
      .andWhere("ticket.closed", status);
    return result[0].count;
  }

  async getTicketByCustomerOrProtocol(id) {
    try {
      return database(tableName)
        .select({
          id: "ticket.id",
          id_seq: "ticket.id_seq",
          ids_crm: "ticket.ids_crm",
          id_customer: "ticket.id_customer",
          id_protocol: "ticket.id_protocol",
          id_user: "users.id_users_core",
          closed: "ticket.closed",
          sla: "ticket.sla",
          sla_time: "phase.sla_time",
          id_unit_of_time: "phase.id_unit_of_time",
          id_form: "ticket.id_form",
          name: "phase.name",
          department_origin: `ticket.department_origin`,
          created_at: "phase_ticket.created_at",
          updated_at: "ticket.updated_at",
        })
        .leftJoin("users", "users.id", "ticket.id_user")
        .leftJoin("phase_ticket", "phase_ticket.id_ticket", `${tableName}.id`)
        .leftJoin("phase", "phase.id", "phase_ticket.id_phase")
        .where("phase_ticket.active", true)
        .andWhere("ticket.id_customer", id)
        .orWhere("ticket.id_protocol", id);
    } catch (err) {
      console.log("===>", err);
      return err;
    }
  }

  async last_interaction() {
    try {
      return await database("activities_ticket")
        .select("users.name")
        .leftJoin("users", "users.id", "activities_ticket.id_user")
        .orderBy("activities_ticket.created_at", "desc")
        .limit(1);
    } catch (err) {
      console.log("====Error last interaction ===>", err);
      return err;
    }
  }

  async first_interaction(id) {
    try {
      return await database("activities_ticket")
        .select("created_at")
        .where("id_ticket", id)
        .orderBy("created_at", "asc")
        .limit(1);
    } catch (err) {
      console.log("====Error last interaction ===>", err);
      return err;
    }
  }

  async last_interaction_ticket(id) {
    try {
      return await database("activities_ticket")
        .select(["users.id_users_core", "users.name"])
        .leftJoin("users", "users.id", "activities_ticket.id_user")
        .where("id_ticket", id)
        .orderBy("activities_ticket.created_at", "desc")
        .limit(1);
    } catch (err) {
      console.log("====Error last interaction ticket ===>", err);
      return err;
    }
  }

  async getTicketStatusCount(id_company) {
    try {
      return await database("vw_dash_tickets")
        .select("*")
        .where({ id_company });
    } catch (err) {
      console.log("status ====>", err);
      return res.status(400).send({
        error:
          "There was an error while trying to obtain status count of tickets",
      });
    }
  }

  async getTicketByIDForm(id_form, id_phase) {
    try {
      const data = await database("phase_ticket")
        .select({
          id: "ticket.id",
          id_seq: "ticket.id_seq",
          ids_crm: "ticket.ids_crm",
          id_user: "users.id_users_core",
          id_customer: "ticket.id_customer",
          id_protocol: "ticket.id_protocol",
          closed: "ticket.closed",
          sla: "ticket.sla",
          id_form: `ticket.id_form`,
          department_origin: `ticket.department_origin`,
          created_at: "ticket.created_at",
          updated_at: "ticket.updated_at",
        })
        .leftJoin("ticket", "ticket.id", "phase_ticket.id_ticket")
        .leftJoin("users", "users.id", "ticket.id_user")
        .where("phase_ticket.id_phase", id_phase)
        .andWhere("phase_ticket.active", true)
        .where("ticket.id_form", id_form);

      return data[0];
    } catch (err) {
      console.log("Error when select ticket by id Form ====>", err);
      return err;
    }
  }

  async getHistoryTicket(id_ticket) {
    try {
      return await database("phase_ticket")
        .select({
          id: "phase_ticket.id",
          id_phase: "phase_ticket.id_phase",
          id_user: "users.id_users_core",
          id_form: "phase_ticket.id_form",
          created_at: "phase_ticket.created_at",
        })
        .leftJoin("users", "users.id", "phase_ticket.id_user")
        .where("phase_ticket.id_ticket", id_ticket)
        .orderBy("phase_ticket.created_at", "asc");
    } catch (err) {
      console.log("Error when select history ticket ===>", err);
      return err;
    }
  }

  async getFirstFormTicket(id_ticket) {
    try {
      return await database("phase_ticket")
        .select(
          "phase.id",
          "phase.id_form_template",
          "phase_ticket.created_at",
          "phase.form"
        )
        .leftJoin("phase", "phase.id", "phase_ticket.id_phase")
        .where("phase_ticket.id_ticket", id_ticket)
        .orderBy("phase_ticket.created_at", "asc");
    } catch (err) {
      console.log("Error Get First Form Ticket ==>", err);
      return err;
    }
  }

  async getResponsibleByTicketAndUser(id_ticket, id_user) {
    try {
      return await database("responsible_ticket")
        .where("id_ticket", id_ticket)
        .andWhere("id_user", id_user);
    } catch (err) {
      console.log("Error get responsible by ticket and user => ", err);
      return err;
    }
  }

  async updateResponsible(id_ticket, id_user, obj) {
    try {
      return await database("responsible_ticket")
        .update(obj)
        .where("id_ticket", id_ticket)
        .andWhere("id_user", id_user);
    } catch (err) {
      console.log("Error update responsible", err);
      return err;
    }
  }

  async linkProtocolToticket(obj) {
    try {
      return await database("ticket_protocol").insert(obj);
    } catch (err) {
      console.log("Erro ao linkar o protocolo ao ticket", err);
      return err;
    }
  }

  async getProtocolTicket(id_ticket, id_company) {
    try {
      return await database("ticket_protocol")
        .select()
        .where("id_ticket", id_ticket)
        .andWhere("id_company", id_company);
    } catch (err) {
      console.log("Erro ao linkar o protocolo ao ticket", err);
      return err;
    }
  }
}

module.exports = TicketModel;
