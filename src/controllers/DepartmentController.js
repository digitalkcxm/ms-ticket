import DepartmentModel from "../models/DepartmentModel.js";
import SLAModel from "../models/SLAModel.js"
export default class DepartmentController {
  constructor(database = {}, logger = {}) {
    this.logger = logger;
    this.slaModel = new SLAModel(database, logger);
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
        
        let ids = []
        Array.isArray(phases) && phases.length > 0 && phases.map(x => ids.push("'"+x.id_phase+"'"))

        obj.push({
          id_department: department.id_department_core,
          counter_sla: { 
            emdia: ids.length> 0 ? await this.slaModel.getSLAEmDia(ids,req.headers.authorization): 0, 
             atrasado:ids.length> 0 ?  await this.slaModel.getSLAAtrasado(ids,req.headers.authorization): 0,
           },
        });
      }
      return res.status(200).send(obj);
    } catch (err) {
      this.logger.error(err, "Error get count sla department.");
      return res.status(400).send({ error: "Houve um problema" });
    }
  }
}
