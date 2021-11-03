class CustomerModel {
    async getAll(ticketId) {
      try {
        return await database('customer')
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
          .orderBy('created_at', 'desc')
      } catch (err) {
        return err
      }
    }
  
    async getByID(ticketId, id) {
      try {
        return await database('customer')
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
  
    async getByIDCore(coreId) {
      try {
        return await database('customer')
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
        return await database('customer')
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
  
    async updateCustomer(id, obj) {
      try {
        return await database('customer')
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