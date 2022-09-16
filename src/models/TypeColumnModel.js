const tableName = "type_column"
export default class TypeColumnModel {
    constructor(database, logger){
        this.database = database
        this.logger = logger
     
    }
    async getTypeByName(name) {
        try {
            
            return await this.database.raw(`select * from type_column where name ilike '%${name.replace('"', "").replace('"', "")}%'`)
        } catch (err) {
            this.logger.error(err,"Error get type by name.")
            return err
        }
    }
    async getTypeByID(id) {
        try {
            return await this.database(tableName).where('id', id)
        } catch (err) {
            this.logger.error(err,"Error get type by id.")
            return err
        }
    }
}