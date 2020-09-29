const database = require("../config/database/database")
const tableName = "ticket"
class TicketModel {
    async create(obj) {
        try {
            return await database(tableName).returning(["id"]).insert(obj)
        } catch (err) {
            console.log("Error when create ticket =>", err)
            return err
        }
    }

    async createPhaseTicket(obj) {
        try {
            return await database("phase_ticket").returning(["id"]).insert(obj)
        } catch (err) {
            console.log("Error when create history phase ticket => ", err)
            return err
        }
    }
    async createResponsibleTicket(obj) {
        try {
            return await database("responsible_ticket").returning(["id"]).insert(obj)
        } catch (err) {
            console.log("Error when create responsible ticket =>", err)
            return err
        }
    }

    async createAttachmentsTicket(obj) {
        try {
            return await database("attachments_ticket").returning(["id"]).insert(obj)
        } catch (err) {
            console.log("Error when create attachments Ticket => ", err)
            return err
        }
    }

    async createActivitiesTicket(obj) {
        try {
            return await database("activities_ticket").returning(["id"]).insert(obj)
        } catch (err) {
            console.log("Error when create activities ticket => ", err)
        }
    }

    async getTicketById(id, id_company) {
        try {
            return await database(tableName)
                .select({
                    id: `${tableName}.id`,
                    ids_crm: `${tableName}.ids_crm`,
                    id_customer: `${tableName}.id_customer`,
                    created_at: `${tableName}.created_at`,
                    updated_at: `${tableName}.updated_at`,
                    id_user: "users.id_users_core"
                })
                .leftJoin("users", "users.id", `${tableName}.id_user`)
                .where(`${tableName}.id`, id)
                .andWhere(`${tableName}.id_company`, id_company)
        } catch (err) {
            console.log("Error when get ticket by id => ", err)
            return err
        }
    }

    async getAllTickets(id_company) {
        try {
            return await database(tableName)
                .select({
                    id: `${tableName}.id`,
                    ids_crm: `${tableName}.ids_crm`,
                    id_customer: `${tableName}.id_customer`,
                    created_at: `${tableName}.created_at`,
                    updated_at: `${tableName}.updated_at`,
                    id_user: "users.id_users_core"
                })
                .leftJoin("users", "users.id", `${tableName}.id_user`)
                .where(`${tableName}.id_company`, id_company)
        } catch (err) {
            console.log("Error when get ticket by id => ", err)
            return err
        }
    }

    async getTypeAttachments(id) {
        try {
            return await database("type_attachments").where("id", id)
        } catch (err) {
            console.log("Error when get type attachments by id => ", err)
            return err
        }
    }
}

module.exports = TicketModel