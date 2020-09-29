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
            return await database(tableName).where("id", id).andWhere("id_company", id_company)
        } catch (err) {
            console.log("Error when get ticket by id => ", err)
            return err
        }

    }
}

module.exports = TicketModel