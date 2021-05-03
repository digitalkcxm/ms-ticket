const database = require("../config/database/database")
const tableName = "type_column"

class TypeColumnModel {
    async getTypeByID(id) {
        try {
            return await database(tableName).where('id', id)
        } catch (err) {
            console.log("Error when get type column by id ==>", err)
            return err
        }
    }
}

module.exports = TypeColumnModel