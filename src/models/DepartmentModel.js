const tableName = "department";
export default class DepartmentModel {
  constructor(database = {},logger = {}){
    this.database = database
    this.logger = logger
  }

  async getByID(department_id, company_id) {
    try {
      return await this.database(tableName)
        .select("id")
        .where("id_company", company_id)
        .andWhere("id_department_core", department_id);
    } catch (err) {
      this.logger.error(err,"Error when get department by ID.");
      return err;
    }
  }

  async create(obj) {
    try {
      return await this.database(tableName).returning(["id"]).insert(obj);
    } catch (err) {
      this.logger.error(err,"Error when create department.");
      return err;
    }
  }

  async getByIDCompany(id_company) {
    try {
      return await this.database("department")
        .select("id", "id_department_core")
        .where("id_company", id_company);
    } catch (err) {
      this.logger.error(err,"error get by id company.");
      return false;
    }
  }

  async getDepartmentPhaseByDepartment(id_department) {
    try {
      return await this.database("department_phase")
        .select({
          id_phase: "department_phase.id_phase",
          name: "phase.name",
        })
        .leftJoin("phase", "phase.id", "department_phase.id_phase")
        .where("department_phase.id_department", id_department)
        .andWhere("department_phase.active", true)
        .andWhere("phase.active", true);

    } catch (err) {
      this.logger.error(err,"Error get department phase by department.");
      return false;
    }
  }

  async getDepartmentByPhase(id_phase) {
    try {
      return await this.database("department_phase")
        .leftJoin(
          "department",
          "department.id",
          "department_phase.id_department"
        )
        .where("department_phase.active", true)
        .andWhere("department_phase.id_phase", id_phase);
    } catch (err) {
      this.logger.error(err,"Error get departmet by phase.");
      return false;
    }
  }
}


