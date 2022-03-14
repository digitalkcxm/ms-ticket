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
    let obj = {
      emdia: 0,
      atrasado: 0,
      sem_sla: 0,
    };
    const slas = await this.slaModel.getSLASettings(phase_id);
    if (slas && slas.length > 0) {
      let sla_ticket;
      if (!customer) {
        sla_ticket = await this.slaModel.getToCountSLA(phase_id, closed);
      } else {
        sla_ticket = await this.slaModel.getToCountSLAWithCustomer(
          phase_id,
          closed,
          customer
        );
      }

      if (sla_ticket && sla_ticket.rows && sla_ticket.rows.length > 0) {
        for await (const sla of sla_ticket.rows) {
          switch (sla.id_sla_type) {
            case 1:
              if (sla.active) {
                if (sla.id_sla_status == 1) {
                  obj.emdia = obj.emdia + 1;
                } else if (sla.id_sla_status == 2) {
                  obj.atrasado = obj.atrasado + 1;
                }
              } else {
                const nextSLA = sla_ticket.rows.filter(
                  (x) =>
                    (x.id_ticket === sla.id_ticket && x.id_sla_type === 2) ||
                    (x.id_ticket === sla.id_ticket && x.id_sla_type === 3)
                );
                if (nextSLA.length <= 0) {
                  switch (sla.id_status) {
                    case 2:
                      if (sla.id_sla_status == 1) {
                        obj.emdia = obj.emdia + 1;
                      } else if (sla.id_sla_status == 2) {
                        obj.atrasado = obj.atrasado + 1;
                      }
                      break;
                    case 3:
                      if (sla.id_sla_status == 1) {
                        obj.emdia = obj.emdia + 1;
                      } else if (sla.id_sla_status == 2) {
                        obj.atrasado = obj.atrasado + 1;
                      }
                      break;
                    default:
                      break;
                  }
                }
              }
              break;
            case 2:
              if (!sla.interaction_time) {
                if (sla.id_sla_status === 1) {
                  obj.emdia = obj.emdia + 1;
                } else {
                  obj.atrasado = obj.atrasado + 1;
                }
              } else {
                const nextSLA = sla_ticket.rows.filter(
                  (x) => x.id_sla_type === 3 && x.active
                );

                if (nextSLA.length > 0) {
                  if (nextSLA[0].id_sla_status === 2) {
                    obj.atrasado = obj.atrasado + 1;
                  } else {
                    obj.emdia = obj.emdia + 1;
                  }
                }
              }
              break;
            case 3:
              if (!sla.active) {
                const nextSLA = sla_ticket.rows.filter(
                  (x) => x.id_sla_type === 2 && x.interaction_time
                );
                if (nextSLA.length > 0) {
                  if (sla.id_sla_status === 1) {
                    obj.emdia = obj.emdia + 1;
                  } else if (sla.id_sla_status === 2) {
                    obj.atrasado = obj.atrasado + 1;
                  }
                }
              }
              break;

            default:
              break;
          }
        }
      } else {
        obj.sem_sla = obj.sem_sla + sla_ticket.rows.length;
      }
    } else {
      const ticket = await this.ticketModel.getTicketByPhaseAndStatus(
        phase_id,
        JSON.stringify([closed])
      );
      obj.sem_sla = obj.sem_sla + ticket.length;
    }
    if (phase_id === "2f5820a0-4a70-11ec-8101-bf6389e52d08")
      console.log("==OBJ ===>", obj);
    return obj;
  }

  async settingsSLA(id, database = {}, logger = {}) {
    const slas = await this.slaModel.getSLASettings(id);
    let sla = {};
    for await (const value of slas) {
      const unit_of_time = await this.unitOfTimeModel.checkUnitOfTime(
        value.id_unit_of_time
      );
      switch (parseInt(value.id_sla_type)) {
        case 1:
          sla = {
            ...sla,
            1: {
              unit_of_time,
              time: value.time,
              active: true,
            },
          };
          break;
        case 2:
          sla = {
            ...sla,
            2: {
              unit_of_time,
              time: value.time,
              active: true,
            },
          };
          break;
        case 3:
          sla = {
            ...sla,
            3: {
              unit_of_time,
              time: value.time,
              active: true,
            },
          };
          break;
        default:
          break;
      }
    }
    return sla;
  }

  async ticketSLA(phase_id, ticket_id) {
    
    const slas = await this.slaModel.getSLASettings(phase_id);
    let sla = {};
    if (slas && slas.length > 0) {
      for await (const value of slas) {
        const ticket = await this.slaModel.getByPhaseTicket(
          phase_id,
          ticket_id,
          value.id_sla_type
        );
        console.log;
        if (ticket && ticket.length > 0) {
          switch (value.id_sla_type) {
            case 1:
              sla = {
                ...sla,
                1: {
                  name: value.name,
                  status: ticket[0].name,
                  limit_sla_time: moment(ticket[0].limit_sla_time).format(
                    "DD/MM/YYYY HH:mm:ss"
                  ),
                  active: ticket[0].active,
                },
              };
              break;
            case 2:
              sla = {
                ...sla,
                2: {
                  name: value.name,
                  status: ticket[0].name,
                  limit_sla_time: moment(ticket[0].limit_sla_time).format(
                    "DD/MM/YYYY HH:mm:ss"
                  ),
                  active: ticket[0].active,
                },
              };
              break;
            case 3:
              sla = {
                ...sla,
                3: {
                  name: value.name,
                  status: ticket[0].name,
                  limit_sla_time: moment(ticket[0].limit_sla_time).format(
                    "DD/MM/YYYY HH:mm:ss"
                  ),
                  active: ticket[0].active,
                },
              };
              break;
            default:
              break;
          }
        }
      }
    }

    return sla;
  }

  async ticketControl(value, id_ticket, id_phase) {
    const momentFormated = await newTime(value.time, value.id_unit_of_time);
    await this.slaModel.slaTicketControl({
      id_ticket: id_ticket,
      id_phase: id_phase,
      id_sla_type: value.id_sla_type,
      id_sla_status: sla_status.emdia,
      limit_sla_time: momentFormated,
      created_at: moment(),
      updated_at: moment(),
    });
  }

  async createSLAControl(id_phase, id_ticket) {
    const slaSettings = await this.slaModel.getSLASettings(id_phase);

    if (slaSettings && slaSettings.length > 0) {
      for await (const value of slaSettings) {
        switch (value.id_sla_type) {
          case 1:
            const getSLA = await this.slaModel.getByPhaseTicket(
              id_phase,
              id_ticket,
              1
            );
            if (getSLA && Array.isArray(getSLA) && getSLA.length <= 0) {
              await this.ticketControl(value, id_ticket, id_phase);
            }
            break;
          case 2:
            if (slaSettings.filter((x) => x.id_sla_type === 1)) {
              let getSLA = await this.slaModel.getByPhaseTicket(
                id_phase,
                id_ticket,
                1
              );
              if (getSLA[0] && getSLA[0].interaction_time) {
                getSLA = await this.slaModel.getByPhaseTicket(
                  id_phase,
                  id_ticket,
                  2
                );
                if (getSLA && Array.isArray(getSLA) && getSLA.length <= 0) {
                  await this.ticketControl(value, id_ticket, id_phase);
                }
              }
            } else {
              await this.ticketControl(value, id_ticket, id_phase);
            }
            break;
          case 3:
            if (slaSettings.filter((x) => x.id_sla_type === 1)) {
              let getSLA = await this.slaModel.getByPhaseTicket(
                id_phase,
                id_ticket,
                1
              );
              if (getSLA[0] && getSLA[0].interaction_time) {
                getSLA = await this.slaModel.getByPhaseTicket(
                  id_phase,
                  id_ticket,
                  3
                );
                if (getSLA && Array.isArray(getSLA) && getSLA.length <= 0) {
                  await this.ticketControl(value, id_ticket, id_phase);
                }
              }
            } else {
              await this.ticketControl(value, id_ticket, id_phase);
            }
            break;
          default:
            console.log(`Unmapped type`);
            break;
        }
      }
    }
  }

  // Função responsavel por atualizar o controle de sla do ticket.
  async updateSLA(id_ticket, id_phase, activity = false) {
    // Busca a configuração de sla do ticket pela phase e id_do ticket, primeiramente pela opção de inicialização do ticket.
    let slaTicket = await this.slaModel.getByPhaseTicket(
      id_phase,
      id_ticket,
      1
    );

    // Inicializa uma variavel de obj.
    let obj;

    // Verifica se a configuração existe e se ainda está ativa.
    if (slaTicket[0] && slaTicket[0].active) {
      // Verifica se o limite de tempo determinado pela configuração é menor que o momento atual.
      if (slaTicket[0].limit_sla_time < moment()) {
        // Se sim, considera o sla como atrasado e desativa ele com o tempo atual.
        obj = {
          id_sla_status: sla_status.atrasado,
          active: false,
          interaction_time: moment(),
        };
      } else if (slaTicket[0].limit_sla_time > moment()) {
        // Se o tempo limite for maior que o momento o controle considera a resposta dentro do prazo.
        obj = {
          id_sla_status: sla_status.emdia,
          active: false,
          interaction_time: moment(),
        };
      }
      // Atualiza o controle de sla do ticket
      await this.slaModel.updateTicketSLA(id_ticket, obj, 1, id_phase);

      await this.createSLAControl(id_phase, id_ticket);
      if (activity) {
        slaTicket = await this.slaModel.getByPhaseTicket(
          id_phase,
          id_ticket,
          2
        );
        if (
          slaTicket &&
          slaTicket.length > 0 &&
          slaTicket[0].limit_sla_time &&
          !slaTicket[0].interaction_time &&
          slaTicket[0].limit_sla_time < moment()
        ) {
          obj = {
            id_sla_status: sla_status.atrasado,
            active: false,
            interaction_time: moment(),
          };
        } else if (
          slaTicket &&
          slaTicket.length > 0 &&
          slaTicket[0].limit_sla_time > moment()
        ) {
          obj = {
            id_sla_status: sla_status.emdia,
            active: false,
            interaction_time: moment(),
          };
        }
        await this.slaModel.updateTicketSLA(id_ticket, obj, 2, id_phase);
      }
    } else {
      slaTicket = await this.slaModel.getByPhaseTicket(id_phase, id_ticket, 2);

      if (
        slaTicket &&
        slaTicket.length > 0 &&
        slaTicket[0].limit_sla_time &&
        !slaTicket[0].interaction_time &&
        slaTicket[0].limit_sla_time < moment()
      ) {
        obj = {
          id_sla_status: sla_status.atrasado,
          active: false,
          interaction_time: moment(),
        };
      } else if (
        slaTicket &&
        slaTicket.length > 0 &&
        slaTicket[0].limit_sla_time > moment()
      ) {
        obj = {
          id_sla_status: sla_status.emdia,
          active: false,
          interaction_time: moment(),
        };
      }
      if (obj) await this.slaModel.updateTicketSLA(id_ticket, obj, 2, id_phase);
      return true;
    }
  }
}
