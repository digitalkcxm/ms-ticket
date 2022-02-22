import { counter_sla } from "../helpers/SLAFormat.js";
import DepartmentModel from "../models/DepartmentModel.js";
export default class DepartmentController {
  constructor(database = {}, logger = {}) {
    this.logger = logger;
    this.departmentModel = new DepartmentModel(database, logger);
  }

  async checkDepartmentCreated(department, company_id) {
    try {
      let result = await this.departmentModel.getByID(department, company_id);
      if (!result || result.length <= 0)
        result = await this.departmentModel.create({
          id_company: company_id,
          id_department_core: department,
        });

      return result;
    } catch (err) {
      this.logger.error(err, "Error when check department created.");
    }
  }

  async getCountSLADepartment(req, res) {
    try {
      const departments = await this.departmentModel.getByIDCompany(
        req.headers.authorization
      );
      const obj = [];
      for await (const department of departments) {
        const phases =
          await this.departmentModel.getDepartmentPhaseByDepartment(
            department.id
          );
        let emdia = 0;
        let atrasado = 0;

        for await (const phase of phases) {
          const sla = await counter_sla(phase.id_phase);
          emdia = parseInt(sla.emdia) + emdia;
          atrasado = parseInt(sla.atrasado) + atrasado;
        }
        obj.push({
          id_department: department.id_department_core,
          counter_sla: { emdia, atrasado },
        });
      }
      return res.status(200).send(obj);
    } catch (err) {
      this.logger(err, "Error get count sla department.");
      return res.status(400).send({ error: "Houve um problema" });
    }
  }
}
