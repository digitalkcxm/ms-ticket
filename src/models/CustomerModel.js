import database from "../config/database/database.js";
const tableName = "customer";

export default class CustomerModel {
  constructor(database = {}, logger = {}) {
    this.database = database;
    this.logger = logger;
  }
  async create(obj) {
    try {
      return await this.database(tableName).returning(["id"]).insert(obj);
    } catch (err) {
      this.logger.error(err, "Error when create phase.");
      return err;
    }
  }

  async getAll(ticketId) {
    try {
      return await this.database(tableName)
        .select(
          "id",
          "id_core",
          "id_ticket",
          "name",
          "email",
          "phone",
          "identification_document",
          "crm_ids",
          "crm_contact_id",
          "created_at",
          "updated_at"
        )
        .where({ id_ticket: ticketId })
        .orderBy("updated_at", "desc");
    } catch (err) {
      this.logger.error(
        err,
        `Error get all customer linked ticket with ID ${ticketId}`
      );
      return err;
    }
  }

  async getByIdentification_document(identification_document) {
    try {
      return await this.database(tableName)
        .select(
          "id",
          "id_core",
          "id_ticket",
          "name",
          "email",
          "phone",
          "identification_document",
          "crm_ids",
          "crm_contact_id",
          "created_at",
          "updated_at"
        )
        .where({ identification_document: identification_document })
        .whereNot("id_ticket", id_ticket)
        .orderBy("updated_at", "desc");
    } catch (err) {
      this.logger.error(err, "Error get customer by identification document.");
      return err;
    }
  }

  async getByID(id) {
    try {
      return await this.database(tableName)
        .select(
          "id",
          "id_core",
          "id_ticket",
          "name",
          "email",
          "phone",
          "identification_document",
          "crm_ids",
          "crm_contact_id",
          "created_at",
          "updated_at"
        )
        .where("crm_contact_id", id);
    } catch (err) {
      this.logger.error(
        err,
        `Error when get customer by crm contact id with ID ${id}`
      );
      return err;
    }
  }

  async getTicketByIDCRMCustomer(status, id, department) {
    try {
      let newStatus =
        JSON.parse(status).length > 0
          ? status.replace("[", "").replace("]", "")
          : "0";
      const query = await this.database.raw(`
      SELECT DISTINCT ticket.id_seq,
        phase.id,
        department.id_department_core,
        phase.icon,
        phase.name,
        phase.order,
        phase.created_at,
        phase.updated_at,
        ticket.closed,
        ticket.department_origin,
        ticket.display_name,
        ticket.id as id_ticket,
        ticket.id_user,
        ticket.id_status,
        ticket.start_ticket,
        ticket.id_seq,
        ticket.created_at as created_at_ticket,
        ticket.updated_at as updated_at_ticket,
        status_ticket.name as status
      FROM customer
      LEFT JOIN ticket ON ticket.id = customer.id_ticket
      LEFT JOIN phase_ticket ON phase_ticket.id_ticket = ticket.id
      LEFT JOIN phase ON phase.id = phase_ticket.id_phase
      LEFT JOIN department_phase ON department_phase.id_phase = phase.id
      LEFT JOIN department ON department.id = department_phase.id_department
      LEFT JOIN status_ticket ON status_ticket.id = ticket.id_status
      WHERE ticket.closed IN (${newStatus})
      AND department.id_department_core = ${department}
      AND phase_ticket.active = true
      AND phase.active = true
      AND customer.crm_contact_id = '${id}'
      `);
      return query.rows;
      // ("customer").select(['DISTINCT ticket.id_seq'])
      //   .leftJoin("ticket", "ticket.id", "customer.id_ticket")
      //   .leftJoin("phase_ticket", "phase_ticket.id_ticket", "ticket.id")
      //   .leftJoin("phase",'phase.id','phase_ticket.id_phase')
      //   .whereIn('ticket.closed',newStatus)
      //   .andWhere("phase_ticket.active",true)
      //   .andWhere("phase.active", true)
      //   .andWhere('customer.crm_contact_id', id)
    } catch (err) {
      this.logger.error(err, "Error when get ticket by id crm contact id.");
      return err;
    }
  }

  async delCustomerTicket(id_ticket) {
    try {
      return await this.database("customer")
        .andWhere("id_ticket", id_ticket)
        .del();
    } catch (err) {
      this.logger.error(err, "Error when get responsible Ticket.");
      return err;
    }
  }

  async getByIDCore(coreId) {
    try {
      return await this.database(tableName)
        .select(
          "id",
          "id_core",
          "id_ticket",
          "name",
          "email",
          "phone",
          "identification_document",
          "crm_ids",
          "crm_contact_id",
          "created_at",
          "updated_at"
        )
        .where("id_core", coreId);
    } catch (err) {
      this.logger.error(
        err,
        "Error when get by id customer of core aplication."
      );
      return err;
    }
  }

  async insertCustomer(obj) {
    try {
      return await this.database(tableName)
        .returning([
          "id",
          "id_core",
          "id_ticket",
          "name",
          "email",
          "phone",
          "identification_document",
          "crm_ids",
          "crm_contact_id",
          "created_at",
          "updated_at",
        ])
        .insert(obj);
    } catch (err) {
      this.logger.error(err, "Error create a new customer.");
      return err;
    }
  }

  async update(obj, id) {
    try {
      return await this.database(tableName)
        .returning([
          "id",
          "id_core",
          "id_ticket",
          "name",
          "email",
          "phone",
          "identification_document",
          "crm_ids",
          "crm_contact_id",
          "created_at",
          "updated_at",
        ])
        .update(obj)
        .where({ id });
    } catch (err) {
      this.logger.error(err, `Error when update customer with ID ${id}`);
      return err;
    }
  }
}
