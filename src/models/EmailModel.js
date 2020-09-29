const database = require("../config/database/database")

const tableName = "email"

class EmailModel {
    async getEmailByEmail(email, company_id) {
        try {
            return await database(tableName).select("id").where("email", email).andWhere("id_company", company_id)
        } catch (err) {
            console.log("Error when catch email by email => ", err)
            return err
        }
    }

    async createEmail(obj) {
        try {
            return await database(tableName).returning(["id"]).insert(obj)
        } catch (err) {
            console.log("Error when create email register => ", err)
            return err
        }
    }

    async getEmailById(id, id_company) {
        try {
            return await database(tableName).where("id",id).andWhere('id_company',id_company)
        } catch (err) {
            console.log("Error when catch email by id => ", err)
            return err
        }
    }
}

module.exports = EmailModel