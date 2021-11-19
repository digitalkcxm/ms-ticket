const database = require("../config/database/database")
const tableName = "type_column"

class TypeColumnModel {
    async getTypeByName(name) {
        try {
            return await database.raw(`select * from type_column where name ilike '%${name}%'`)
        } catch (err) {
            return err
        }
    }
    async getTypeByID(id) {
        try {
            return await database.raw(tableName).where('id', id)
        } catch (err) {
            return err
        }
    }
}

module.exports = TypeColumnModel