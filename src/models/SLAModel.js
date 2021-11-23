const database = require("../config/database/database");

class SLAModel {
  async slaPhaseSettings(obj) {
    try {
      await database("phase_sla_settings")
        .delete()
        .where("id_phase", obj.id_phase);
      return await database("phase_sla_settings").insert(obj);
    } catch (err) {
      console.log("error sla phase settings =>", err);
      return err;
    }
  }

  async getSLASettings(idPhase) {
    try {
      return await database("phase_sla_settings")
        .leftJoin("sla_type", "sla_type.id", "phase_sla_settings.id_sla_type")
        .where("id_phase", idPhase)
        .orderBy("phase_sla_settings.id_sla_type", "asc");
    } catch (err) {
      console.log("get sla settings -----> ", idPhase);
      return err;
    }
  }

  async getSLASettingsType(idPhase, type) {
    try {
      return await database("phase_sla_settings")
        .leftJoin("sla_type", "sla_type.id", "phase_sla_settings.id_sla_type")
        .where("phase_sla_settings.id_phase", idPhase)
        .andWhere("sla_type.id", type);
    } catch (err) {
      console.log("get sla settings -----> ", idPhase);
      return err;
    }
  }

  async slaTicketControl(obj) {
    try {
      return await database("ticket_sla_control").insert(obj);
    } catch (err) {
      console.log("error sla ticket control => ", err);
      return err;
    }
  }

  async getTicketControl(id_phase, id_status, id_sla_type) {
    try {
      const result = await database("ticket_sla_control as tsc")
        .count()
        .leftJoin("phase_ticket as pt", "pt.id_ticket", "tsc.id_ticket")
        .leftJoin("ticket", "ticket.id", "pt.id_ticket")
        .where("pt.id_phase", id_phase)
        .andWhere("tsc.id_sla_status", id_status)
        .andWhere("pt.active", true)
        .andWhere("tsc.id_sla_type", id_sla_type);
      return result[0].count;
    } catch (err) {
      console.log("error when get sla's =>", err);
      return err;
    }
  }

  async getByPhaseTicket(id_phase, id_ticket, id_sla_type) {
    try {
      console.log(id_phase, id_ticket, id_sla_type);
      return await database("ticket_sla_control as tsc")
        .leftJoin("phase_ticket as pt", "pt.id_phase", "tsc.id_phase")
        .leftJoin("sla_status as ss", "ss.id", "tsc.id_sla_type")
        .where("tsc.id_phase", id_phase)
        .andWhere("tsc.id_ticket", id_ticket)
        .andWhere("pt.active", true)
        .andWhere("tsc.id_sla_type", id_sla_type);
    } catch (err) {
      console.log("error when get sla's =>", err);
      return err;
    }
  }

  async checkSLA(type) {
    try {
      // Pega todos os tickets com status em aberto e atualiza seus status.
      return await database("ticket_sla_control as tsc")
        .where("tsc.id_sla_status", 3)
        .andWhere("tsc.id_sla_type", type)
        .andWhere("tsc.active", true);
    } catch (err) {
      console.log("Error check sla ==>", err);
      return err;
    }
  }

  async updateTicketSLA(id_ticket, obj, id_type, id_phase) {
    try {
      return await database("ticket_sla_control")
        .update(obj)
        .where("id_ticket", id_ticket)
        .andWhere("id_sla_type", id_type)
        .andWhere("id_phase", id_phase);
    } catch (err) {
      console.log("error when updaet sla ticket ==>", err);
      return err;
    }
  }

  async disableSLA(id_ticket) {
    try {
      return await database("ticket_sla_control")
        .update({ active: false })
        .where("id_ticket", id_ticket);
    } catch (err) {
      console.log("Error when disable sla ticket =>", err);
      return err;
    }
  }
}

module.exports = SLAModel;
