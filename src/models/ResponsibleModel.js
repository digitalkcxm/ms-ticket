import moment from "moment";

export default class ResponsibleModel {
  constructor(database = {}, logger = {}) {
    (this.logger = logger), (this.database = database);
  }

  async getAllResponsibleByTicket(id_ticket) {
    try {
      return await this.database("responsible_ticket")
        .select({
          id:"responsible_ticket.id",
          id_user: "users.id_users",
          name: "users.name",
          active: "responsible_ticket.active",
          created_at: "responsible_ticket.created_at",
          updated_at: "responsible_ticket.updated_at",
        })
        .leftJoin("users", "users.id", "responsible_ticket.id_user")
        .where("responsible_ticket.id_ticket", id_ticket)
    } catch (err) {
      this.logger.error(err, "Erro ao capturar os reponsaveis do ticket.");
      return false;
    }
  }

  async getActiveResponsibleByTicket(id_ticket) {
    try {
      return await this.database("responsible_ticket")
        .select({
          id:"responsible_ticket.id",
          id_user: "users.id_users",
          name: "users.name",
          active: "responsible_ticket.active",
          created_at: "responsible_ticket.created_at",
          updated_at: "responsible_ticket.updated_at",
        })
        .leftJoin("users", "users.id", "responsible_ticket.id_user")
        .where("responsible_ticket.id_ticket", id_ticket)
        .andWhere("responsible_ticket.active", true);
    } catch (err) {
      this.logger.error(err, "Erro ao capturar os reponsaveis do ticket.");
      return false;
    }
  }

  async disableResponsible(id, act_user){
      try{
        return await this.database("responsible_ticket").update({active:false, updated_at:moment(), id_user_remove: act_user}).where("id",id)
      }catch(err){
        this.logger.error(err, "Erro ao desativar os reponsaveis do ticket.");
        return false;
      }
  }
}
