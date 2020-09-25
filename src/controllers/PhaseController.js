const CompanyModel = require("../models/CompanyModel")
const DepartmentModel = require("../models/DepartmentModel")
const UserModel = require("../models/UserModel")

const companyModel = new CompanyModel()
const departmentModel = new DepartmentModel()
const userModel = new UserModel()
class PhaseController {
    async create(req, res) {
        try {
            let dpt = []
            let users = []
            const companyVerified = await companyModel.getById(req.headers.authorization)
            if (companyVerified.length <= 0)
                return res.status(400).send({ error: "Please check your company authorization" })

            if (req.body.departments.length <= 0)
                return res.status(400).send({ error: "Invalid department id" })

            req.body.departments.map(async department => {
                let result = await this._checkDepartmentCreated(department, req.headers.authorization)
                dpt.push(result[0].id)
            })

            req.body.responsible.map(async responsible => {
                let result
                if (responsible.id){
                    result = await this._checkUserCreated(responsible.id, req.headers.authorization)   
                }else if(responsible.email){
                    console.log("TESTE")
                }

            })
            return res.status(200).send("OK")
        } catch (err) {
            console.log("Error when manage phase create => ", err)
            return res.status(400).send({ error: "Error when manage phase create" })
        }
    }

    async _checkDepartmentCreated(department, company_id) {
        try {
            let result = await departmentModel.getByID(department, company_id)
            if (!result || result.length <= 0)
                result = await departmentModel.create({
                    "id_company": company_id,
                    "id_department_core": department
                })
            return result
        } catch (err) {
            console.log("Error when check department created =>", err)
        }
    }

    async _checkUserCreated(user, company_id){
        try{
            let result = await userModel.getUserByID(user,company_id)
            if (!result || result.length <= 0){
                result = await userModel.create({
                    "id_users_core":user,
                    "id_company":company_id
                })
            }

            return result
        }catch(err){
            console.log("Error when verify user if created")
        }
    }
}

module.exports = PhaseController
