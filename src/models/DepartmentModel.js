const database = require("../config/database/database");
const tableName = "department";
class DepartmentModel {
  async getByID(department_id, company_id) {
    try {
      return await database(tableName)
        .select("id")
        .where("id_company", company_id)
        .andWhere("id_department_core", department_id);
    } catch (err) {
      console.log("Error when get department by ID => ", err);
      return err;
    }
  }

  async create(obj) {
    try {
      return await database(tableName).returning(["id"]).insert(obj);
    } catch (err) {
      console.log("Error when create department => ", err);
      return err;
    }
  }

  async getByIDCompany(id_company) {
    try {
      return await database("department")
        .select("id", "id_department_core")
        .where("id_company", id_company);
    } catch (err) {
      console.log("error get by id company => ", err);
      return false;
    }
  }

  async getDepartmentPhaseByDepartment(id_department) {
    try {
      return await database("department_phase")
        .select({
          id_phase: "department_phase.id_phase",
          name: "phase.name",
        })
        .leftJoin("phase", "phase.id", "department_phase.id_phase")
        .where("department_phase.id_department", id_department);
    } catch (err) {
      console.log("Error get department phase by department =>", err);
      return false;
    }
  }

  async getDepartmentByPhase(id_phase) {
    try {
      return await database("department_phase")
        .leftJoin(
          "department",
          "department.id",
          "department_phase.id_department"
        )
        .where("department_phase.active", true)
        .andWhere("department_phase.id_phase", id_phase);
    } catch (err) {
      console.log("Error get departmet by phase =>", err);
      return false;
    }
  }
}

module.exports = DepartmentModel;
