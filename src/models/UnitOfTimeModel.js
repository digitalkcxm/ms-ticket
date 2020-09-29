const database = require("../config/database/database")
const tableName = "unit_of_time"
class UnitOfTimeModel {
    async getUnitOfTime(id){
        try{
            return await database(tableName).where("id",id)
        }catch(err){
            console.log("Error when catch unit of time types => ",err)
            return err
        }
    }
}

module.exports = UnitOfTimeModel