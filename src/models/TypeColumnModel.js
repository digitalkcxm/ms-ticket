const database = require("../config/database/database")
const tableName = "type_column"

class TypeColumnModel {
    async getTypeByName(name) {
        try {
            return await database(tableName).where('name', name)
        } catch (err) {
            return err
        }
    }
    async getTypeByID(id) {
        try {
            return await database(tableName).where('id', id)
        } catch (err) {
            return err
        }
    }
}

module.exports = TypeColumnModel