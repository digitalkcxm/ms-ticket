const database = require('../config/database/database')
const tableName = "attachments_ticket"

class AttachmentsModel {
    async getCountAttachments(id_ticket) {
        try {
            const resultCount = await database(tableName).count().where("id_ticket", id_ticket)
            return resultCount[0].count
        } catch (err) {
            console.log("Error when get count total attachments of ticket mencioned ====>", err)
            return err
        }
    }

    async getAttachments(id_ticket) {
        try {
            return await database("attachments_ticket").select({
                "id": "attachments_ticket.id",
                "url": "attachments_ticket.url",
                "type": "type_attachments.name",
                "id_user": "users.id_users",
                "name": "attachments_ticket.name",
                "created_at": "attachments_ticket.created_at",
                "updated_at": "attachments_ticket.updated_at"
            })
                .leftJoin("type_attachments", "type_attachments.id", "attachments_ticket.type")
                .leftJoin("users", "users.id", "attachments_ticket.id_user")
                .where("attachments_ticket.id_ticket", id_ticket)
        } catch (err) {
            console.log("Error get Attachments ====>", err)
            return err
        }
    }

    async create(obj) {
        try {
            return await database(tableName).returning(['id']).insert(obj)
        } catch (err) {
            console.log("Error when create activities ===>", err)
            return err
        }
    }
}

module.exports = AttachmentsModel