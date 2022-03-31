import database from "../config/database/database.js"
const tableName = "unit_of_time"
export default class UnitOfTimeModel {
    async getUnitOfTime(id){
        try{
            return await database(tableName).where("id",id)
        }catch(err){
            console.log("Error when catch unit of time types => ",err)
            return err
        }
    }
    async checkUnitOfTime(id_unit_of_time){
        
        switch (id_unit_of_time) {
            case 1:
                return ["seconds","Segundos"]
                break;
            case 2:
                return ["minutes","Minutos"]
                break;
            case 3:
                return ["hours","Horas"]
                break;
            case 4:
                return ["days","Dias"]
                break;
            default:
                break;
        }

    }

    async checkUnitOfTimeByName(unit_of_time){
        let type = ""
        switch (unit_of_time) {
            case 'seconds':
                type = 1
                break;
            case 'minutes':
                type = 2
                break;
            case 'hours':
                type = 3
                break;
            case 'days':
                type = 4
                break;
            default:
                break;
        }

        return type
    }
}
