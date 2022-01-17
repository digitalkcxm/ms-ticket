const database = require("../config/database/database");
const tableName = "customer";
const moment = require("moment");

class CustomerModel {
  async create(obj) {
    try {
      return await database(tableName).returning(["id"]).insert(obj);
    } catch (err) {
      console.log("Error when create phase => ", err);
      return err;
    }
  }

  async getAll(ticketId) {
    try {
      return await database(tableName)
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
      return err;
    }
  }

  async getByIdentification_document(identification_document, id_ticket) {
    try {
      return await database(tableName)
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
      return err;
    }
  }

  async getByID(id) {
    try {
      return await database(tableName)
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
      console.log("Error =<", err);
      return err;
    }
  }

  async getTicketByIDCRMCustomer(status,id,department) {
    try {
     
      let newStatus =  JSON.parse(status).length > 0 ? status.replace('[', '').replace(']', '') : '0'
      
 
      console.log(status,id)
      const query =  await database.raw(`
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
      `)
      return query.rows
      // ("customer").select(['DISTINCT ticket.id_seq'])
      //   .leftJoin("ticket", "ticket.id", "customer.id_ticket")
      //   .leftJoin("phase_ticket", "phase_ticket.id_ticket", "ticket.id")
      //   .leftJoin("phase",'phase.id','phase_ticket.id_phase')
      //   .whereIn('ticket.closed',newStatus)
      //   .andWhere("phase_ticket.active",true)
      //   .andWhere("phase.active", true)
      //   .andWhere('customer.crm_contact_id', id)
    } catch (err) {
      console.log("Error when get ticket by id crm contact id", err);
      return err;
    }
  }

  async delCustomerTicket(id_ticket) {
    try {
      return await database("customer").andWhere("id_ticket", id_ticket).del();
    } catch (err) {
      console.log("Error when get responsible Ticket =>", err);
      return err;
    }
  }

  async getByIDCore(coreId) {
    try {
      return await database(tableName)
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
      console.log("Error =<", err);
      return err;
    }
  }

  async insertCustomer(obj) {
    try {
      return await database(tableName)
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
      return err;
    }
  }

  async update(obj, id) {
    try {
      return await database(tableName)
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
      return err;
    }
  }
}

module.exports = CustomerModel;
