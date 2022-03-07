const tableName = "activities_ticket";
export default class ActivitiesModel {
  constructor(database = {}, logger = {}) {
    this.database = database;
    this.logger = logger;
  }
  async getCountActivities(id_ticket) {
    try {
      const resultCount = await this.database(tableName)
        .count()
        .where("id_ticket", id_ticket);
      return resultCount[0].count;
    } catch (err) {
      this.logger.error(err,"Error when get count activities.");
      return err;
    }
  }

  async getActivities(id_ticket) {
    try {
      return await this.database(tableName)
        .select({
          id: `${tableName}.id`,
          message: `${tableName}.text`,
          id_user: "users.id_users",
          name: "users.name",
          source: "type_user.name",
          created_at: `${tableName}.created_at`,
          updated_at: `${tableName}.updated_at`,
        })
        .leftJoin("users", "users.id", `${tableName}.id_user`)
        .leftJoin("type_user", "type_user.id", `users.id_type`)
        .where(`${tableName}.id_ticket`, id_ticket);
    } catch (err) {
      this.logger.error(err,"Error get activities.");
      return err;
    }
  }

  async create(obj) {
    try {
      return await this.database(tableName).returning(["id"]).insert(obj);
    } catch (err) {
      this.logger.error(err,"Error when create activities.");
      return err;
    }
  }
}
