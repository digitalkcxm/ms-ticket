const database = require('../config/database/database')
const tableName = "company"
class CompanyModel {
    async create(obj) {
        try {
            return await database(tableName).returning("id").insert(obj)
        } catch (err) {
            console.log("Erro when create company ==>", err)
            return err
        }
    }

    async getById(id) {
        try {
            return await database(tableName).where("id", id)
        } catch (err) {
            console.log("Error when get company by id ==>", err)
            return err
        }
    }

    async update(obj, id) {
        try {
            return await database(tableName).update(obj).where("id", id)
        } catch (err) {
            console.log("Error when update company => ", err)
            return err
        }
    }
}

module.exports = CompanyModel