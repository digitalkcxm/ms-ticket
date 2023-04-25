import moment from "moment";
import { check } from "express-validator";
import { newTime } from "../helpers/ConvertTime.js";
import SLAModel from "../models/SLAModel.js";
import TicketModel from "../models/TicketModel.js";
import UnitOfTimeModel from "../models/UnitOfTimeModel.js";

// const sla_status_id = [1, 2, 3];
const sla_status = {
  emdia: 1,
  atrasado: 2,
  aberto: 3,
};

export default class SLAController {
  constructor(database = {}, logger = {}) {
    this.logger = logger;
    this.slaModel = new SLAModel(database, logger);
    this.ticketModel = new TicketModel(database, logger);
    this.unitOfTimeModel = new UnitOfTimeModel(database, logger);
  }

  async counter_sla(phase_id, closed = false, customer = false) {
    let [sla_tickets, result] = ['', { 'emdia': 0, 'atrasado': 0, 'sem_sla': 0 }];

    !customer
      ? sla_tickets = await this.slaModel.getToCountSLA(phase_id, closed)
      : sla_tickets = await this.slaModel.getToCountSLAWithCustomer(phase_id, closed, customer)

    for (let i = 0; i < sla_tickets.length; i++) {
      const timeLimit = moment(sla_tickets[i].limit_sla_time).format('DD-MM-YYYY HH:mm:ss');
      const lastInteraction = sla_tickets[i].interaction_time
        ? moment(sla_tickets[i].interaction_time).format('DD-MM-YYYY HH:mm:ss')
        : null

      sla_tickets[i].id_status == 1 || timeLimit >= lastInteraction
        ? result.emdia = result.emdia + 1
        : result.atrasado = result.atrasado + 1
    }

    const slaPhaseSettings = await this.slaModel.getSLASettings(phase_id);
    slaPhaseSettings && slaPhaseSettings.length <= 0
      ? result.sem_sla = await this.slaModel.getAllTicketsWithoutSLA(phase_id, closed)
      : result.sem_sla = Math.abs(
        parseInt(await this.slaModel.getAllTicketsWithoutSLA(phase_id, closed))
        - parseInt(result.emdia)
        - parseInt(result.atrasado)
      )

    return { emdia: result.emdia, atrasado: result.atrasado, sem_sla: result.sem_sla };
  }

  async settingsSLA(id) {
    if (!id) return false
    
    const slas = await this.slaModel.getSLASettings(id);
    let sla = {};
    await slas.map(async value => {
      const unit_of_time = await this.unitOfTimeModel.checkUnitOfTime(
        value.id_unit_of_time
      );
      sla = {
        ...sla,
        [value.id_sla_type]: {
          unit_of_time: unit_of_time[1],
          time: value.time,
          active: true,
        },
      };
    })
    return sla;
  }

  async ticketSLA(phase_id, ticket_id) {
    const slas = await this.slaModel.getSLASettings(phase_id);
    let sla = {};
    if (slas && slas.length > 0) {
      let status = []
      for await (const value of slas) {
        const ticket = await this.slaModel.getByPhaseTicket(
          phase_id,
          ticket_id
        );

        if (ticket && ticket.length > 0) {
          ticket.filter((x) => {
            if (x.id_sla_type === value.id_sla_type) return status.push(x);
          });

          if (status.length > 0) {
            sla = {
              ...sla,
              [value.id_sla_type]: {
                name: value.name,
                status: status[0].name,
                limit_sla_time: ticket[0].limit_sla_time, //moment(ticket[0].limit_sla_time).format("DD/MM/YYYY HH:mm:ss"),
                active: status[0].active,
              },
            };
          }
        }
      }
    }

    return sla;
  }

  async ticketControl(value, id_ticket, id_phase) {
    try {
      const momentFormated = await newTime(value.time, value.id_unit_of_time);
      return await this.slaModel.slaTicketControl({
        id_ticket: id_ticket,
        id_phase: id_phase,
        id_sla_type: value.id_sla_type,
        id_sla_status: sla_status.emdia,
        limit_sla_time: momentFormated,
        created_at: moment().add(1, "seconds"),
        updated_at: moment().add(1, "seconds"),
      });
    } catch (err) {
      this.logger.error(err, "Error when create sla control.");
      return false;
    }
  }

  async createSLAControl(id_phase, id_ticket) {
    try {
      const slaSettings = await this.slaModel.getSLASettings(id_phase);
      if (slaSettings && slaSettings.length > 0) {
        const getSLA = await this.slaModel.getByPhaseTicket(
          id_phase,
          id_ticket
        );

        for await (const value of slaSettings) {
          switch (value.id_sla_type) {
            case 1:
              if (
                getSLA &&
                Array.isArray(getSLA) &&
                getSLA.filter((x) => x.id_sla_type === value.id_sla_type)
                  .length <= 0
              ) {
                await this.ticketControl(value, id_ticket, id_phase);
              }
              break;
            case 2:
            case 3:
              console.log("sla", getSLA);
              if (
                slaSettings.find((x) => x.id_sla_type === 1) &&
                getSLA.filter((x) => x.id_sla_type === 1 && x.interaction_time)
                  .length > 0
              ) {
                if (
                  getSLA &&
                  Array.isArray(getSLA) &&
                  getSLA.filter((x) => x.id_sla_type === value.id_sla_type)
                    .length <= 0
                ) {
                  await this.ticketControl(value, id_ticket, id_phase);
                }
              } else if (!slaSettings.find((x) => x.id_sla_type === 1)) {
                if (
                  getSLA &&
                  Array.isArray(getSLA) &&
                  getSLA.filter((x) => x.id_sla_type === value.id_sla_type)
                    .length <= 0
                ) {
                  await this.ticketControl(value, id_ticket, id_phase);
                }
              }
              break;
            default:
              console.log(`Unmapped type`);
              break;
          }
        }
        return true;
      }
    } catch (err) {
      this.logger.error(err, "Error when manage sla control.");
      return false;
    }
  }

  // Função responsavel por atualizar o controle de sla do ticket.
  async updateSLA(id_ticket, id_phase, sla_type) {
    // Busca a configuração de sla do ticket pela phase e id_do ticket, primeiramente pela opção de inicialização do ticket.
    let controleSLA = await this.slaModel.getByPhaseTicket(id_phase, id_ticket);

    // valida se existe controle de sla, e se é um array.
    if (controleSLA && Array.isArray(controleSLA) && controleSLA.length > 0) {
      for (const sla of controleSLA) {
        // valida se a configuração de sla está ativa, caso não esteja não pode sofrer ação.
        if (!sla.interaction_time) {
          let obj = {};

          if (sla_type === sla.id_sla_type)
            obj = { ...obj, active: false, interaction_time: moment() };

          // Valida se o sla está atrasado ou em dia.
          if (sla.limit_sla_time < moment()) {
            obj = { ...obj, id_sla_status: sla_status.atrasado };
          } else if (sla.limit_sla_time > moment()) {
            obj = { ...obj, id_sla_status: sla_status.emdia };
          }

          // Atualiza o controle de sla do ticket
          await this.slaModel.updateTicketSLA(
            id_ticket,
            obj,
            sla.id_sla_type,
            id_phase
          );

          await this.createSLAControl(id_phase, id_ticket);
        }
      }
    }
  }
}
