const database = require("../config/database/database")
const { table } = require("../config/database/database")
const tableName = "phase"

class PhaseModel {
    async createPhase(obj) {
        try {
            return await database(tableName).returning(["id"]).insert(obj)
        } catch (err) {
            console.log("Error when create phase => ", err)
            return err
        }
    }

    async getPhaseById(id_phase, id_company) {
        try {
            return await database(tableName).select({
                "id": "phase.id",
                "id_unit_of_time": "phase.id_unit_of_time",
                "unit_of_time": "unit_of_time.name",
                "icon": "phase.icon",
                "name": "phase.name",
                "sla_time": "phase.sla_time",
                "responsible_notify_sla": "phase.responsible_notify_sla",
                "supervisor_notify_sla": "phase.supervisor_notify_sla",
            })
                .leftJoin("unit_of_time", "unit_of_time.id", "phase.id_unit_of_time")
                .where("phase.id", id_phase)
                .andWhere("phase.id_company", id_company)
        } catch (err) {
            console.log("Error when catch phase and tickets by id phase => ", err)
            return err
        }
    }
    async getPhase(id, id_company) {
        try {
            return await database(tableName).where("id", id).andWhere("id_company", id_company)
        } catch (err) {
            console.log("Error when catch phase by id => ", err)
            return err
        }
    }

    async createResponsiblePhase(obj) {
        try {
            return await database("responsible_phase").returning(["id"]).insert(obj)
        } catch (err) {
            console.log("Error when create responsible phase => ", err)
            return err
        }
    }

    async createNotifyPhase(obj) {
        try {
            return await database("notify_phase").returning(["id"]).insert(obj)
        } catch (err) {
            console.log("Error when create notify phase => ", err)
            return err
        }
    }

    async getResponsiblePhase(phase_id) {
        try {
            return await database("phase").select({
                "phase": "phase.id",
                "phase_description": "phase.name",
                "id_user_core": "users.id_users_core",
                "id_user": "users.id",
                "email": "email.email",
                "id_email": "email.id"
            })
                .leftJoin("responsible_phase", "responsible_phase.id_phase", "phase.id")
                .leftJoin("users", "users.id", "responsible_phase.id_user")
                .leftJoin("email", "email.id", "responsible_phase.id_email")
                .where("phase.id", phase_id)
        } catch (err) {
            console.log("Error when get notified phase =>", err)
            return err
        }
    }

    async getNotifiedPhase(phase_id) {
        try {
            return await database("phase").select({
                "phase": "phase.id",
                "phase_description": "phase.name",
                "id_user_core": "users.id_users_core",
                "id_user": "users.id",
                "email": "email.email",
                "id_email": "email.id"
            })
                .leftJoin("notify_phase", "notify_phase.id_phase", "phase.id")
                .leftJoin("users", "users.id", "notify_phase.id_user")
                .leftJoin("email", "email.id", "notify_phase.id_email")
                .where("phase.id", phase_id)
        } catch (err) {
            console.log("Error when get notified phase =>", err)
            return err
        }
    }

    async getResponsiblePhaseByIdUser(id_user, id_phase) {
        try {
            return await database("responsible_phase").where("id_user", id_user).andWhere("id_phase", id_phase)
        } catch (err) {
            console.log("Error when get responsible phase by id User => ", err)
            return err
        }
    }

    async getNotifyPhaseByIdUser(id_user, id_phase) {
        try {
            return await database("notify_phase").where("id_user", id_user).andWhere("id_phase", id_phase)
        } catch (err) {
            console.log("Error when get notify by id user ==>", err)
            return err
        }
    }

    async disablePhaseTicket(id_ticket) {
        try {
            return await database('phase_ticket').update({ active: "false" }).where("id_ticket", id_ticket)
        } catch (err) {
            console.log("Error when disable phase ticket linked")
            return err
        }
    }

    async getAllPhase(id_company) {
        try {
            return await database(tableName).select(["id", "id_unit_of_time", "icon", "name", "sla_time", "responsible_notify_sla", "supervisor_notify_sla", "created_at", "updated_at"]).where("id_company", id_company)
        } catch (err) {
            return res.status(400).send({ error: "There was an error " })
        }
    }

    async updatePhase(obj, id_phase, id_company) {
        try {
            return await database(tableName).update(obj).where("id", id_phase).andWhere("id_company", id_company)
        } catch (err) {
            console.log("Error update phase => ", err)
            return err
        }
    }

    async delResponsiblePhase(id_phase) {
        try {
            return await database("responsible_phase").andWhere("id_phase", id_phase).del()
        } catch (err) {
            console.log("Error when get responsible Ticket =>", err)
            return err
        }
    }


    async delNotifyPhase(id_phase) {
        try {
            return await database("notify_phase").andWhere("id_phase", id_phase).del()
        } catch (err) {
            console.log("Error when get responsible Ticket =>", err)
            return err
        }
    }
}

module.exports = PhaseModel