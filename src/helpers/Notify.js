import CallbackDigitalk from "../services/CallbackDigitalk.js";
import moment from "moment";

const perfis = ["customer", "admin", "separate", "responsible"];

export default async function Notify(
  id_ticket,
  id_phase,
  id_company,
  action,
  callback,
  classes
) {
  const { phaseModel, ticketModel, customerModel } = classes;
  const phase = await phaseModel.getPhaseById(id_phase, id_company);
  const ticket = await ticketModel.getTicketById(id_ticket, id_company);

  let obj = {
    type: "notification",
    id_ticket: ticket[0].id_seq,
    id_protocol: ticket[0].id_protocol,
    customer: await customerModel.getAll(ticket[0].id),
    id_phase,
    id_department: phase[0].id_department,
    created_at: moment().format("DD/MM/YYYY HH:mm:ss"),
  };

  perfis.map((x) =>
      handleMassage(obj, action, x, ticket[0], phase[0], callback)
  );
}

const handleMassage = async function (
  obj,
  action,
  perfil,
  ticket,
  phase,
  callback
) {
  console.log("perfil", perfil)
  obj = {
    ...obj,
    message: `
      Uma atividade foi criada\n\n
      Identificador da atividade: ${ticket.id_seq}\n${
      ticket.id_protocol ? `\n        Protocolo: ${ticket.id_protocol}\n` : ""
    }
      Fase: ${phase.name}\n
      Data de criação: ${moment().format("DD/MM/YYYY")}\n
      Hora: ${moment().format("HH:mm:ss")}
      `,
  };

  if (perfil === "separate") {
    if (phase[perfil] && phase[perfil].separate.length > 0) {
      for (const separate of phase[perfil].separate) {
        if (separate[`notify_${action}`]) {
          const email = separate.contact.filter((x) => x.email);
          const phone = separate.contact.filter((x) => x.phone);

          obj = {
            ...obj,
            notified: perfil,
            email: email.length > 0 ? email[0].email : "",
            phone: phone.length > 0 ? phone[0].phone : "",
          };

          obj = validateObj(obj, perfil, action, phase);
          CallbackDigitalk(obj, callback);
        }
      }
    }
  } else {
    console.log("teste perfil",phase)
    if (phase[perfil] && phase[perfil][`notify_${action}`]) {
      obj = {
        ...obj,
        notified: perfil,
      };
      obj = validateObj(obj, perfil, action, phase);
      CallbackDigitalk(obj, callback);
    }
  }
};

const validateObj = function (obj, perfil, action, phase) {
  if (phase[perfil][`notify_${action}_message`])
    obj.message = phase[perfil][`notify_${action}_message`];
  if (phase[perfil][`notify_${action}_hsm`])
    obj.hsm_id = phase[perfil][`notify_${action}_hsm`];
  if (phase[perfil].channels) obj.channels = phase[perfil].channels;

  return obj;
};
