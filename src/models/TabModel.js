const tableName = "tab"

export default class TabModel {
    constructor(database ){
        this.database = database
    }
    async create(obj) {
        try {
            return await this.database(tableName).returning(["id"]).insert(obj)
        } catch (err) {
            console.log("Erro when create company ==>", err)
            return err
        }
    }

    async getByTicket(id_ticket) {
        try {
            return await this.database(tableName).select({
                id_tab:"tab.id_tab",
                description:"tab.description",
                id_user:"users.id_users",
                created_at:"tab.created_at"
                
            })
            .leftJoin("users","users.id","tab.id_user")
            .where("id_ticket",id_ticket)
        } catch (err) {
            console.log("Erro ao captar a tabulação pelo ticket.",err)
            return false
        }
    }
}

