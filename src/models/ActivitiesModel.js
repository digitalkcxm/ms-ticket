const { table } = require("../config/database/database")
const database = require("../config/database/database")
const tableName = "activities_ticket"
class ActivitiesModel {
    async getCountActivities(id_ticket) {
        try {
            const resultCount = await database(tableName).count().where("id_ticket", id_ticket)
            return resultCount[0].count
        } catch (err) {
            console.log("Error when get count activities ===>", err)
            return err
        }
    }


    async getActivities(id_ticket) {
        try {
            return await database(tableName).select({
                "id": `${tableName}.id`,
                "text": `${tableName}.text`,
                "id_user": "users.id_users_core",
                "created_at": `${tableName}.created_at`,
                "updated_at": `${tableName}.updated_at`
            })
                .leftJoin("users", "users.id", `${tableName}.id_user`)
                .where(`${tableName}.id_ticket`, id_ticket)
        } catch (err) {
            console.log("Error get activities ====>", err)
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

module.exports = ActivitiesModel