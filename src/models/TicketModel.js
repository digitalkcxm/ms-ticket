const database = require("../config/database/database")
const moment = require("moment")
const tableName = "ticket"
class TicketModel {
    async create(obj, table) {
        try {
            return await database(table).returning(["id"]).insert(obj)
        } catch (err) {
            console.log("Error when create ticket =>", err)
            return err
        }
    }

    async getTicketById(id, id_company) {
        try {
            return await database(tableName)
                .select({
                    id: `${tableName}.id`,
                    ids_crm: `${tableName}.ids_crm`,
                    id_customer: `${tableName}.id_customer`,
                    id_company: `${tableName}.id_company`,
                    phase: "phase_ticket.id_phase",
                    id_user: "users.id_users_core",
                    sla_time: "phase.sla_time",
                    unit_of_time: "phase.id_unit_of_time",
                    created_at: `${tableName}.created_at`,
                    updated_at: `${tableName}.updated_at`
                })
                .leftJoin("users", "users.id", `${tableName}.id_user`)
                .leftJoin("phase_ticket", "phase_ticket.id_ticket", `${tableName}.id`)
                .leftJoin("phase", "phase.id", "phase_ticket.id_phase")
                .where(`${tableName}.id`, id)
                .andWhere(`${tableName}.id_company`, id_company)
                .orderBy("phase_ticket.id", "desc").limit(1)
        } catch (err) {
            console.log("Error when get ticket by id => ", err)
            return err
        }
    }

    async getAllTickets(id_company) {
        try {
            return await database(tableName)
                .max({
                    id: `${tableName}.id`,
                    ids_crm: `${tableName}.ids_crm`,
                    id_customer: `${tableName}.id_customer`,
                    phase: "phase_ticket.id_phase",
                    id_user: "users.id_users_core",
                    created_at: `${tableName}.created_at`,
                    updated_at: `${tableName}.updated_at`
                })
                .leftJoin("users", "users.id", `${tableName}.id_user`)
                .leftJoin("phase_ticket", "phase_ticket.id_ticket", `${tableName}.id`)
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

    async updateTicket(obj, id, id_company) {
        try {
            return await database(tableName).update(obj).where("id", id).andWhere("id_company", id_company)
        } catch (err) {
            console.log("Update ticket => ", err)
            return err
        }
    }

    async delResponsibleTicket(id_ticket) {
        try {
            return await database("responsible_ticket").andWhere("id_ticket", id_ticket).del()
        } catch (err) {
            console.log("Error when get responsible Ticket =>", err)
            return err
        }
    }

    async closedTicket(id_ticket) {
        try {
            return await database(tableName).returning(["id"]).update({
                "closed": true,
                "updated_at": moment().format()
            }).where("id", id_ticket)
        } catch (err) {
            console.log("Error when update Ticket to closed")
            return err
        }
    }

    async getAllTicketWhitoutCompanyId() {
        try {
            return await database(tableName).select()
        } catch (err) {
            console.log("Error when catch all ticket =>", err)
            return err
        }
    }

    async updateSlaTicket(obj, id) {
        try {
            return await database(tableName).update(obj).where("id", id)
        } catch (err) {
            console.log("Error when update sla ticket =>", err)
            return err
        }
    }

    async getAllResponsibleTicket(id_ticket) {
        try {
            return await database("responsible_ticket").where('id_ticket', id_ticket)
        } catch (err) {
            console.log("Error when get all responsible ticket => ", err)
            return err
        }
    }

    async getTicketByPhase(id_phase) {
        try {
            return await database("phase_ticket").select({
                "id": "ticket.id",
                "ids_crm": "ticket.ids_crm",
                "id_user": "users.id_users_core",
                "id_customer": "ticket.id_customer",
                "closed": "ticket.closed",
                "sla": "ticket.sla"
            })
                .leftJoin("ticket", "ticket.id", "phase_ticket.id_ticket")
                .leftJoin("users", "users.id", "ticket.id_user")
                .where("phase_ticket.id_phase", id_phase)
                .andWhere("phase_ticket.active", true)
        } catch (err) {
            console.log("Error when get Ticket by phase =>", err)
            return err
        }
    }
}

module.exports = TicketModel