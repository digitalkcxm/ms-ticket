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
            return await database(tableName).where("id", id).andWhere('id_company', id_company)
        } catch (err) {
            console.log("Error when catch email by id => ", err)
            return err
        }
    }

    async createLinkedEmailWithChatId(chat_id, id_email, id_ticket) {
        try {
            return await database("ticket_email_id").returning(["id"]).insert(obj)
        } catch (err) {
            console.log("Error when link email with chat_id => ", err)
            return err
        }
    }

    async getByChatId(chat_id) {
        try {
            return await database("ticket_email_id").where("chat_id")
        } catch (err) {
            console.log("Get By chat Id Error => ", err)
            return err
        }
    }
}

module.exports = EmailModel