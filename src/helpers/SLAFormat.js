const moment = require("moment");

const SLAModel = require("../models/SLAModel");
const slaModel = new SLAModel();

const UnitOfTimeModel = require("../models/UnitOfTimeModel");
const unitOfTimeModel = new UnitOfTimeModel();

const { newTime } = require("./ConvertTime");

const sla_status_id = [1, 2, 3];
const sla_status = {
  emdia: 1,
  atrasado: 2,
  aberto: 3,
};

const counter_sla = function (phase_id) {
  let obj = {};
  sla_status_id.map(async (x) => {
    switch (x) {
      case 1:
        obj.emdia = await slaModel.getTicketControl(phase_id, x);
        break;
      case 2:
        obj.atrasado = await slaModel.getTicketControl(phase_id, x);
        break;
      case 3:
        obj.aberto = await slaModel.getTicketControl(phase_id, x);
        break;
      default:
        console.log("Unmapped status");
        break;
    }
  });
  return obj;
};

const settingsSLA = async function (id) {
  const slas = await slaModel.getSLASettings(id);

  let sla = {};
  for await (const value of slas) {
    const unit_of_time = await unitOfTimeModel.checkUnitOfTime(
      value.id_unit_of_time
    );

    switch (value.id_sla_type) {
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
};

const ticketSLA = async function (phase_id, ticket_id) {
  const slas = await slaModel.getSLASettings(phase_id);
  let sla = {};
  if (slas && slas.length > 0) {
    for await (const value of slas) {
      const ticket = await slaModel.getByPhaseTicket(
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
};

const createSLAControl = async function (id_phase, id_ticket) {
  const slaSettings = await slaModel.getSLASettings(id_phase);

  if (slaSettings && slaSettings.length > 0) {
    const ticketControl = async function (value) {
      const momentFormated = await newTime(value.time, value.id_unit_of_time);
      await slaModel.slaTicketControl({
        id_ticket: id_ticket,
        id_phase: id_phase,
        id_sla_type: value.id_sla_type,
        id_sla_status: sla_status.aberto,
        limit_sla_time: momentFormated,
      });
    };
    for await (const value of slaSettings) {
      switch (value.id_sla_type) {
        case 1:
          const getSLA = await slaModel.getByPhaseTicket(
            id_phase,
            id_ticket,
            1
          );
          if (getSLA && Array.isArray(getSLA) && getSLA.length <= 0) {
            await ticketControl(value);
          }
          break;
        case 2:
          if (slaSettings.filter((x) => x.id_sla_type === 1)) {
            let getSLA = await slaModel.getByPhaseTicket(
              id_phase,
              id_ticket,
              1
            );
            if (getSLA[0] && getSLA[0].interaction_time) {
              getSLA = await slaModel.getByPhaseTicket(id_phase, id_ticket, 2);
              if (getSLA && Array.isArray(getSLA) && getSLA.length <= 0) {
                await ticketControl(value);
              } else {
                const momentFormated = await newTime(
                  value.time,
                  value.id_unit_of_time
                );
                await slaModel.updateTicketSLA(
                  id_ticket,
                  {
                    id_sla_status: sla_status.aberto,
                    limit_sla_time: momentFormated,
                    interaction_time: moment(),
                  },
                  value.id_sla_type
                );
              }
            }
          } else {
            await ticketControl(value);
          }
          break;
        case 3:
          if (slaSettings.filter((x) => x.id_sla_type === 1)) {
            let getSLA = await slaModel.getByPhaseTicket(
              id_phase,
              id_ticket,
              1
            );
            if (getSLA[0] && getSLA[0].interaction_time) {
              getSLA = await slaModel.getByPhaseTicket(id_phase, id_ticket, 3);
              if (getSLA && Array.isArray(getSLA) && getSLA.length <= 0) {
                await ticketControl(value);
              }
            }
          } else {
            await ticketControl(value);
          }
          break;
        default:
          console.log(`Unmapped type`);
          break;
      }
    }
  }
};

const updateSLA = async function (id_ticket, id_phase) {
  // Atualiza o status atual do sla
  let slaTicket = await slaModel.getByPhaseTicket(id_phase, id_ticket, 1);
  let obj;
  if (!slaTicket[0].interaction_time) {
    if (slaTicket[0].limit_sla_time < moment()) {
      obj = {
        id_sla_status: sla_status.atrasado,
        active: false,
        interaction_time: moment(),
      };
    } else if (slaTicket[0].limit_sla_time > moment()) {
      obj = {
        id_sla_status: sla_status.emdia,
        active: false,
        interaction_time: moment(),
      };
    }
    await slaModel.updateTicketSLA(id_ticket, obj, 1);
    await createSLAControl(id_phase, id_ticket);
  } else {
    slaTicket = await slaModel.getByPhaseTicket(id_phase, id_ticket, 2);

    if (
      slaTicket &&
      slaTicket.length > 0 &&
      slaTicket[0].interaction_time &&
      slaTicket[0].interaction_time < slaTicket[0].limit_sla_time &&
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
    if (obj) await slaModel.updateTicketSLA(id_ticket, obj, 2);
    return true;
  }
};

module.exports = {
  counter_sla,
  settingsSLA,
  ticketSLA,
  createSLAControl,
  updateSLA,
};
