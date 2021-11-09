const database = require("../config/database/database");
const tableName = "customer"
const moment = require("moment");

class CustomerModel {
    async create(obj){
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
            'id',
            'id_core',
            'id_ticket',
            'name',
            'email',
            'phone',
            'identification_document',
            'crm_ids',
            'crm_contact_id',
            'created_at',
            'updated_at'
          )
          .where({ id_ticket: ticketId })
      } catch (err) {
        return err
      }
    }
  
    async getByID(ticketId, id) {
      try {
        return await database(tableName)
          .select(
            'id',
            'id_core',
            'id_ticket',
            'name',
            'email',
            'phone',
            'identification_document',
            'crm_ids',
            'crm_contact_id',
            'created_at',
            'updated_at'
          )
          .where('id', id)
          .andWhere('id_ticket', ticketId)
      } catch (err) {
        console.log('Error =<', err)
        return err
      }
    }

    async delCustomerTicket(id_ticket) {
      try {
        return await database("customer")
          .andWhere("id_ticket", id_ticket)
          .del();
      } catch (err) {
        console.log("Error when get responsible Ticket =>", err);
        return err;
      }
    }
  
    async getByIDCore(coreId) {
      try {
        return await database(tableName)
          .select(
            'id',
            'id_core',
            'id_ticket',
            'name',
            'email',
            'phone',
            'identification_document',
            'crm_ids',
            'crm_contact_id',
            'created_at',
            'updated_at'
          )
          .where('id_core', coreId)
      } catch (err) {
        console.log('Error =<', err)
        return err
      }
    }
  
    async insertCustomer(obj) {
      try {
        return await database(tableName)
          .returning([
            'id',
            'id_core',
            'id_ticket',
            'name',
            'email',
            'phone',
            'identification_document',
            'crm_ids',
            'crm_contact_id',
            'created_at',
            'updated_at'
          ])
          .insert(obj)
      } catch (err) {
        return err
      }
    }
  
    async update(id, obj) {
      try {
        return await database(tableName)
          .returning([
            'id',
            'id_core',
            'id_ticket',
            'name',
            'email',
            'phone',
            'identification_document',
            'crm_ids',
            'crm_contact_id',
            'created_at',
            'updated_at'
          ])
          .update(obj)
          .where({ id })
      } catch (err) {
        return err
      }
    }
  }
  
  module.exports = CustomerModel