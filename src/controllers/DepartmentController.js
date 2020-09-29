const DepartmentModel =require("../models/DepartmentModel")
const departmentModel = new DepartmentModel()

class DepartmentController {
    async checkDepartmentCreated(department, company_id) {
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
}

module.exports = DepartmentController