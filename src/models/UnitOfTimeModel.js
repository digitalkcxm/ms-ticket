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
    async checkUnitOfTime(id_unit_of_time){
        let type = ""
        switch (id_unit_of_time) {
            case 1:
                type = "seconds"
                break;
            case 2:
                type = "minutes"
                break;
            case 3:
                type = "hours"
                break;
            case 4:
                type = "days"
                break;
            default:
                break;
        }

        return type
    }
}

module.exports = UnitOfTimeModel