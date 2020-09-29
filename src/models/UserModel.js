const database = require("../config/database/database")

const tableName = "users"

class UserModel {
    async getUserByID(id, company_id) {
        try {
            return await database(tableName).select("id").where("id_users_core", id).andWhere("id_company", company_id)
        } catch (err) {
            console.log("Error when catch user info by id => ", err)
            return err
        }
    }

    async create(obj) {
        try {
            return await database(tableName).returning(["id"]).insert(obj)
        } catch (err) {
            console.log("Error when create user => ", err)
            return err
        }
    }

    async getById(id, id_company) {
        try {
            return await database("users").where("id", id).andWhere("id_company", id_company)
        } catch (err) {
            console.log("Error when get user by id =>", err)
            return err
        }
    }
}

module.exports = UserModel