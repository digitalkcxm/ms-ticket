const DepartmentModel = require("../models/DepartmentModel");
const departmentModel = new DepartmentModel();
const { validationResult } = require("express-validator");
const { counter_sla } = require("../helpers/SLAFormat");

class DepartmentController {
  async checkDepartmentCreated(department, company_id) {
    try {
      let result = await departmentModel.getByID(department, company_id);
      if (!result || result.length <= 0)
        result = await departmentModel.create({
          id_company: company_id,
          id_department_core: department,
        });

      return result;
    } catch (err) {
      console.log("Error when check department created =>", err);
    }
  }

  async getCountSLADepartment(req, res) {
    try {
      const departments = await departmentModel.getByIDCompany(
        req.headers.authorization
      );
      const obj = [];
      for await (const department of departments) {
        const phases = await departmentModel.getDepartmentPhaseByDepartment(
          department.id
        );
        let emdia = 0;
        let atrasado = 0;
        let aberto = 0;
        for await (const phase of phases) {
          const sla = await counter_sla(phase.id_phase);
          emdia = parseInt(sla.emdia) + emdia;
          atrasado = parseInt(sla.atrasado) + atrasado;
          aberto = parseInt(sla.aberto) + aberto;
        }
        obj.push({
          id_department: department.id_department_core,
          counter_sla: { emdia, aberto, atrasado },
        });
      }
      return res.status(200).send(obj)
    } catch (err) {
      console.log("Error get count sla department =>", err);
      return res.status(400).send({ error: "Houve um problema" });
    }
  }
}

module.exports = DepartmentController;
