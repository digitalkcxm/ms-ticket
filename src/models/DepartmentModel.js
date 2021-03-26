const database = require("../config/database/database")
const tableName = "department"
class DepartmentModel {
    async getByID(department_id, company_id) {
        try {
            return await database(tableName).select("id")
                .where("id_company", company_id)
                .andWhere("id_department_core", department_id)
        } catch (err) {
            console.log("Error when get department by ID => ", err)
            return err
        }
    }

    async create(obj) {
        try {
            return await database(tableName).returning(["id"]).insert(obj)
        } catch (err) {
            console.log("Error when create department => ", err)
            return err
        }
    }
}

module.exports = DepartmentModel