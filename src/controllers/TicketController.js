const TicketModel = require("../models/TicketModel");
const UserController = require("./UserController");
const DepartmentController = require("./DepartmentController");
const PhaseModel = require("../models/PhaseModel");
const EmailController = require("./EmailController");
const UserModel = require("../models/UserModel");
const CompanyModel = require("../models/CompanyModel");
const EmailService = require("../services/EmailService");
const EmailModel = require("../models/EmailModel");
const FormTemplate = require("../documents/FormTemplate");
const FormDocuments = require("../documents/FormDocuments");
const asyncRedis = require("async-redis");
const redis = asyncRedis.createClient(
  process.env.REDIS_PORT,
  process.env.REDIS_HOST
);
const UnitOfTimeModel = require("../models/UnitOfTimeModel");
const { formatTicketForPhase } = require("../helpers/FormatTicket");
const AttachmentsModel = require("../models/AttachmentsModel");
const { validationResult } = require("express-validator");

const moment = require("moment");
const { v1 } = require("uuid");
const notify = require("../helpers/Notify");

const ticketModel = new TicketModel();
const userController = new UserController();
const phaseModel = new PhaseModel();
const emailController = new EmailController();
const userModel = new UserModel();
const companyModel = new CompanyModel();
const emailService = new EmailService();
const emailModel = new EmailModel();
const attachmentsModel = new AttachmentsModel();
const departmentController = new DepartmentController();

const ActivitiesModel = require("../models/ActivitiesModel");
const activitiesModel = new ActivitiesModel();

class TicketController {
  async create(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    try {
      let userResponsible = [];
      let id_user = await userController.checkUserCreated(
        req.body.id_user,
        req.headers.authorization
      );

      req.body.responsible.map(async (responsible) => {
        let result;
        result = await userController.checkUserCreated(
          responsible,
          req.headers.authorization,
          responsible.name
        );
        userResponsible.push(result.id);
      });

      let obj = {
        id: v1(),
        id_company: req.headers.authorization,
        ids_crm: req.body.ids_crm,
        id_customer: req.body.id_customer,
        id_protocol: req.body.id_protocol,
        id_user: id_user.id,
        created_at: moment().format(),
        updated_at: moment().format(),
      };

      if (req.body.department_origin) {
        let department = await departmentController.checkDepartmentCreated(
          req.body.department_origin,
          req.headers.authorization
        );
        obj.department_origin = department[0].id;
      }

      let phase = await phaseModel.getPhase(
        req.body.id_phase,
        req.headers.authorization
      );

      if (req.body.form) {
        if (Object.keys(req.body.form).length > 0) {
          if (phase[0].form) {
            let errors = await this._validateForm(
              req.app.locals.db,
              phase[0].id_form_template,
              req.body.form
            );
            if (errors.length > 0)
              return res.status(400).send({ errors: errors });

            obj.id_form = await new FormDocuments(
              req.app.locals.db
            ).createRegister(req.body.form);
          }
        }
      }

      let result = await ticketModel.create(obj);
      await this._createResponsibles(userResponsible, obj.id);

      if (!phase || phase.length <= 0)
        return res.status(400).send({ error: "Invalid id_phase uuid" });

      let phase_id = await ticketModel.createPhaseTicket({
        id_phase: phase[0].id,
        id_ticket: obj.id,
      });

      if (!phase_id || phase_id.length <= 0)
        return res.status(500).send({ error: "There was an error" });

      // await this._notify(phase[0].id, req.company[0].notify_token, obj.id, userResponsible, emailResponsible, req.headers.authorization, 4, req.app.locals.db)

      let ticket = await ticketModel.getTicketById(
        obj.id,
        req.headers.authorization
      );
      await redis.set(
        `msTicket:ticket:${ticket.id}`,
        JSON.stringify(ticket[0])
      );

      if (result && result.length > 0 && result[0].id) {
        ticket = await formatTicketForPhase(
          ticket,
          req.app.locals.db,
          ticket[0]
        );

        // delete ticket[0].id_company
        return res.status(200).send(ticket);
      }
      await redis.del(`ticket:phase:${req.headers.authorization}`);

      return res.status(400).send({ error: "There was an error" });
    } catch (err) {
      console.log("Error when generate object to save ticket => ", err);
      return res
        .status(400)
        .send({ error: "Error when generate object to save ticket" });
    }
  }

  async queueCreate(data) {
    /*const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });
  */

    try {
      let userResponsible = [];
      let id_user = await userController.checkUserCreated(
        data.id_user,
        data.authorization
      );

      data.responsible.map(async (responsible) => {
        let result;
        result = await userController.checkUserCreated(
          responsible,
          data.authorization,
          responsible.name
        );
        userResponsible.push(result.id);
      });

      let obj = {
        id: v1(),
        id_company: data.authorization,
        ids_crm: data.ids_crm,
        id_customer: data.id_customer,
        id_protocol: data.id_protocol,
        id_user: id_user.id,
        created_at: moment().format(),
        updated_at: moment().format(),
      };

      if (data.department_origin) {
        let department = await departmentController.checkDepartmentCreated(
          data.department_origin,
          data.authorization
        );
        obj.department_origin = department[0].id;
      }

      let phase = await phaseModel.getPhase(
        data.id_phase,
        data.authorization
      );

      if (data.form) {
        console.log(data.app.locals)
        if (Object.keys(data.form).length > 0) {
          if (phase[0].form) {
            let errors = await this._validateForm(
              data.app.locals.db,
              phase[0].id_form_template,
              data.form
            );
            if (errors.length > 0)
              return false

            obj.id_form = await new FormDocuments(
              data.app.locals.db
            ).createRegister(data.form);
          }
        }
      }

      let result = await ticketModel.create(obj);
      await this._createResponsibles(userResponsible, obj.id);

      if (!phase || phase.length <= 0)
        return false

      let phase_id = await ticketModel.createPhaseTicket({
        id_phase: phase[0].id,
        id_ticket: obj.id,
      });

      if (!phase_id || phase_id.length <= 0)
        return false

      // await this._notify(phase[0].id, req.company[0].notify_token, obj.id, userResponsible, emailResponsible, req.headers.authorization, 4, req.app.locals.db)

      let ticket = await ticketModel.getTicketById(
        obj.id,
        data.authorization
      );
      await redis.set(
        `msTicket:ticket:${ticket.id}`,
        JSON.stringify(ticket[0])
      );

      if (result && result.length > 0 && result[0].id) {
        ticket = await formatTicketForPhase(
          ticket,
          data.app.locals.db,
          ticket[0]
        );

        // delete ticket[0].id_company
        return ticket;
      }
      await redis.del(`ticket:phase:${data.authorization}`);

      return false
    } catch (err) {
      console.log("Error when generate object to save ticket => ", err);
      return false
    }
  }

  async _createResponsibles(userResponsible = null, ticket_id) {
    try {
      await ticketModel.delResponsibleTicket(ticket_id);
      if (userResponsible.length > 0) {
        userResponsible.map(async (user) => {
          await ticketModel.createResponsibleTicket({
            id_ticket: ticket_id,
            id_user: user,
            id_type_of_responsible: 2,
          });
        });
      }

      return true;
    } catch (err) {
      console.log("Error when create responsibles ==> ", err);
      return false;
    }
  }

  async _notify(
    phase_id,
    notify_token,
    ticket_id,
    userResponsibleTicket,
    emailResponsibleTicket,
    id_company,
    type,
    db
  ) {
    try {
      let texto = "";
      let register;
      let responsiblePhase = await phaseModel.getResponsiblePhase(phase_id);
      let notifyPhase = await phaseModel.getNotifiedPhase(phase_id);

      const resultPhase = await phaseModel.getPhaseById(phase_id, id_company);
      // if (resultPhase[0].id_form_template) {

      // }

      const result = await ticketModel.getTicketById(ticket_id, id_company);
      if (result[0].form) {
        result[0].form_data = await new FormDocuments(db).findRegister(
          result[0].id_form
        );
        delete result[0].form;
        delete result[0].id_form;

        register = await new FormTemplate(db).findRegistes(
          resultPhase[0].id_form_template
        );
        for (let column of register.column) {
          texto =
            texto +
            `<p><strong>${column.label} : </strong>${
              result[0].form_data[column.column]
                ? result[0].form_data[column.column]
                : ""
            }</p>`;
        }
      }

      switch (type) {
        case 3:
          const phaseInfo = await phaseModel.getPhase(phase_id, id_company);

          if (phaseInfo[0] && phaseInfo[0].responsible_notify_sla) {
            if (responsiblePhase && responsiblePhase.length > 0) {
              responsiblePhase.map(async (contact) => {
                if (contact.id_user) {
                  await notify(notify_token, {
                    id_user: contact.id_user_core,
                    type: type,
                    id_ticket: ticket_id,
                    id_seq: result[0].id_seq,
                    id_phase: phase_id,
                  });
                } else if (contact.email) {
                  await emailService.sendActiveMenssage(
                    `DIGITALK INFORMA: TICKET #${result[0].id_ticket} EXPIROU`,
                    contact.email,
                    `Um ticket expirou em uma fase de sua responsabilidade <br><br> Fase: ${contact.phase_description}  <br><br>  ${texto}`
                  );
                }
              });
            }
          }
          if (userResponsibleTicket && userResponsibleTicket.length > 0) {
            await this._notifyUser(
              type,
              userResponsibleTicket,
              id_company,
              ticket_id,
              phase_id,
              notify_token,
              result[0].id_seq,
              responsiblePhase,
              notifyPhase
            );
          }

          if (emailResponsibleTicket && emailResponsibleTicket.length > 0) {
            for (let i = 0; i < emailResponsibleTicket.length; i++) {
              await responsiblePhase.map((userPhase) => {
                if (userPhase.id_user == emailResponsibleTicket[i]) {
                  delete emailResponsibleTicket[i];
                }
              });

              if (emailResponsibleTicket[i]) {
                await notifyPhase.map((userPhase) => {
                  if (userPhase.id_user == emailResponsibleTicket[i] > 0) {
                    delete emailResponsibleTicket[i];
                  }
                });
              }
              if (emailResponsibleTicket[i]) {
                let infoUser = await emailModel.getEmailById(
                  emailResponsibleTicket[i],
                  id_company
                );
                await emailService.sendActiveMenssage(
                  `DIGITALK INFORMA: TICKET #${result[0].id_ticket} `,
                  infoUser[0].email,
                  `Você foi alertado em um dos seus tickets <br><br>  ${texto}`
                );
              }
            }
          }
          break;
        case 4:
          let body = await emailController.formatEmail(
            result[0].created_at,
            result[0].sla_time,
            result[0].id_seq,
            result[0].name,
            resultPhase[0].name,
            texto,
            result[0].unit_of_time
          );
          let email;
          if (responsiblePhase && responsiblePhase.length > 0) {
            responsiblePhase.map(async (contact) => {
              if (contact.id_user) {
                let resultNotify = await notify(notify_token, {
                  id_user: contact.id_user_core,
                  type: type,
                  id_ticket: ticket_id,
                  id_seq: result[0].id_seq,
                  id_phase: phase_id,
                });
              } else if (contact.email) {
                email = await emailService.sendActiveMenssage(
                  `Ticket ID:${result[0].id_seq}`,
                  contact.email,
                  body
                );
                await emailModel.createLinkedEmailWithChatId(
                  email.data.chatId,
                  contact.id_email,
                  ticket_id
                );
              }
            });
          }
          if (notifyPhase && notifyPhase.length > 0) {
            notifyPhase.map(async (contact) => {
              if (contact.id_user) {
                let resultNotify = await notify(notify_token, {
                  id_user: contact.id_user_core,
                  type: type,
                  id_ticket: ticket_id,
                  id_seq: result[0].id_seq,
                  id_phase: phase_id,
                });
              } else if (contact.email) {
                email = await emailService.sendActiveMenssage(
                  `Ticket ID:${result[0].id_seq}`,
                  contact.email,
                  body
                );
                await emailModel.createLinkedEmailWithChatId(
                  email.data.chatId,
                  contact.id_email,
                  ticket_id
                );
              }
            });
          }

          if (userResponsibleTicket && userResponsibleTicket.length > 0) {
            await this._notifyUser(
              type,
              userResponsibleTicket,
              id_company,
              ticket_id,
              phase_id,
              notify_token,
              result[0].id_seq,
              responsiblePhase,
              notifyPhase
            );
          }
          if (emailResponsibleTicket && emailResponsibleTicket.length > 0) {
            for (let i = 0; i < emailResponsibleTicket.length; i++) {
              await responsiblePhase.map((userPhase) => {
                if (userPhase.id_user == emailResponsibleTicket[i]) {
                  delete emailResponsibleTicket[i];
                }
              });

              if (emailResponsibleTicket[i]) {
                await notifyPhase.map((userPhase) => {
                  if (userPhase.id_user == emailResponsibleTicket[i] > 0) {
                    delete emailResponsibleTicket[i];
                  }
                });
              }

              if (emailResponsibleTicket[i]) {
                let infoUser = await emailModel.getEmailById(
                  emailResponsibleTicket[i],
                  id_company
                );
                email = await emailService.sendActiveMenssage(
                  `Ticket ID:${result[0].id_seq}`,
                  infoUser[0].email,
                  body
                );
                await emailModel.createLinkedEmailWithChatId(
                  email.data.chatId,
                  emailResponsibleTicket[i],
                  ticket_id
                );
              }
            }
          }
          break;
        case 5:
          if (userResponsibleTicket && userResponsibleTicket.length > 0) {
            await this._notifyUser(
              type,
              userResponsibleTicket,
              id_company,
              ticket_id,
              phase_id,
              notify_token,
              result[0].id_seq
            );
          }

          if (emailResponsibleTicket && emailResponsibleTicket.length > 0) {
            for (let i = 0; i < emailResponsibleTicket.length; i++) {
              if (emailResponsibleTicket[i]) {
                let infoUser = await emailModel.getEmailById(
                  emailResponsibleTicket[i],
                  id_company
                );
                await emailService.sendActiveMenssage(
                  `Ticket ID:${result[0].id_seq}`,
                  infoUser[0].email,
                  `Você foi alertado em um dos seus tickets  <br><br> ${texto}`
                );
              }
            }
          }
          break;
        default:
          console.log("Default");
          break;
      }
      return true;
    } catch (err) {
      console.log("Error when notify responsibles ==> ", err);
      return false;
    }
  }

  async _notifyUser(
    type,
    user,
    id_company,
    id_ticket,
    id_phase,
    notify_token,
    id_seq,
    responsiblePhase = null,
    notifyPhase = null
  ) {
    try {
      for (let i = 0; i < user.length; i++) {
        if (user[i] && responsiblePhase) {
          await responsiblePhase.map((userPhase) => {
            if (userPhase.id_user == user[i]) {
              delete user[i];
            }
          });
        }

        if (user[i] && notifyPhase) {
          await notifyPhase.map((userPhase) => {
            if (userPhase.id_user == user[i] > 0) {
              delete user[i];
            }
          });
        }
        if (user[i]) {
          let infoUser = await userModel.getById(user[i], id_company);
          let resultNotify = await notify(notify_token, {
            id_user: infoUser[0].id_users_core,
            type: type,
            id_ticket: id_ticket,
            id_seq: id_seq,
            id_phase: id_phase,
          });
        }
      }

      return true;
    } catch (err) {
      console.log("Error notify user => ", err);
      return err;
    }
  }

  async createActivities(req, res) {
    try {
      if (!req.body.id_user)
        return res.status(400).send({ error: "Whitout id_user" });

      let user = await userController.checkUserCreated(
        req.body.id_user,
        req.headers.authorization
      );

      if (!user || !user.id)
        return res.status(400).send({ error: "There was an error" });

      let ticket = await ticketModel.getTicketById(
        req.body.id_ticket,
        req.headers.authorization
      );
      if (!ticket || ticket.length <= 0)
        return res.status(400).send({ error: "ID ticket is invalid" });

      let obj = {
        text: req.body.text,
        id_ticket: req.body.id_ticket,
        id_user: user.id,
        created_at: moment().format(),
        updated_at: moment().format(),
      };

      let result = await activitiesModel.create(obj);

      if (result && result.length > 0) {
        obj.id = result[0].id;

        return res.status(200).send(obj);
      }

      return res.status(400).send({ error: "There was an error" });
    } catch (err) {
      console.log("Error manage object to create activities => ", err);
      return res.status(400).send({ error: "There was an error" });
    }
  }

  async queueCreateActivities(data) {
    try {
      if (!data.id_user)
        return false

      let user = await userController.checkUserCreated(
        data.id_user,
        data.authorization
      );

      if (!user || !user.id)
        return false

      let ticket = await ticketModel.getTicketById(
        data.id_ticket,
        data.authorization
      );
      if (!ticket || ticket.length <= 0)
        return false

      let obj = {
        text: data.text,
        id_ticket: data.id_ticket,
        id_user: user.id,
        created_at: moment().format(),
        updated_at: moment().format(),
      };

      let result = await activitiesModel.create(obj);

      if (result && result.length > 0) {
        obj.id = result[0].id;

        return obj
      }

      return false
    } catch (err) {
      console.log("Error manage object to create activities => ", err);
      return false
    }
  }

  async createAttachments(req, res) {
    try {
      if (!req.body.id_user)
        return res.status(400).send({ error: "Whitout id_user" });

      let user = await userController.checkUserCreated(
        req.body.id_user,
        req.headers.authorization
      );

      if (!user || !user.id)
        return res.status(400).send({ error: "There was an error" });

      let ticket = await ticketModel.getTicketById(
        req.body.id_ticket,
        req.headers.authorization
      );
      if (!ticket || ticket.length <= 0)
        return res.status(400).send({ error: "ID ticket is invalid" });

      let typeAttachments = await ticketModel.getTypeAttachments(req.body.type);

      if (!typeAttachments || typeAttachments.length <= 0)
        return res.status(400).send({ error: "Type attachments is invalid" });

      let obj = {
        id_user: user.id,
        id_ticket: req.body.id_ticket,
        url: req.body.url,
        type: typeAttachments[0].id,
        name: req.body.name,
        created_at: moment(),
        updated_at: moment(),
      };

      let result = await attachmentsModel.create(obj);

      if (result && result.length > 0) {
        obj.id = result[0].id;

        return res.status(200).send(obj);
      }

      return res.status(400).send({ error: "There was an error" });
    } catch (err) {
      console.log("Error manage object to create attachments => ", err);
      return res.status(400).send({ error: "There was an error" });
    }
  }

  async getTicketByID(req, res) {
    try {
      let result = await ticketModel.getTicketById(
        req.params.id,
        req.headers.authorization
      );
      if (result.name && result.name == "error")
        return res.status(400).send({ error: "There was an error" });

      if (result && result.length <= 0)
        return res
          .status(400)
          .send({ error: "There is no ticket with this ID" });

      result = await formatTicketForPhase(result, req.app.locals.db, result[0]);

      if (result.id_form) {
        result.form_data = await new FormDocuments(
          req.app.locals.db
        ).findRegister(result.id_form);
        delete result.id_form;
      }

      result.attachments = await attachmentsModel.getAttachments(result.id);
      result.attachments.map((value) => {
        value.created_at = moment(value.created_at).format(
          "DD/MM/YYYY HH:mm:ss"
        );
        value.updated_at = moment(value.updated_at).format(
          "DD/MM/YYYY HH:mm:ss"
        );
      });

      result.activities = await activitiesModel.getActivities(result.id);
      result.activities.map((value) => {
        value.created_at = moment(value.created_at).format(
          "DD/MM/YYYY HH:mm:ss"
        );
        value.updated_at = moment(value.updated_at).format(
          "DD/MM/YYYY HH:mm:ss"
        );
      });

      result.history_phase = await ticketModel.getHistoryTicket(result.id);
      result.history_phase.map((value) => {
        value.created_at = moment(value.created_at).format(
          "DD/MM/YYYY HH:mm:ss"
        );
      });

      return res.status(200).send(result);
    } catch (err) {
      console.log("Error when select ticket by id =>", err);
      return res.status(400).send({ error: "There was an error" });
    }
  }

  async getAllTicket(req, res) {
    try {
      let obj = {};
      req.query.department
        ? (obj.department = JSON.parse(req.query.department))
        : "";
      req.query.users ? (obj.users = JSON.parse(req.query.users)) : "";
      req.query.closed
        ? (obj.closed = JSON.parse(req.query.closed))
        : (obj.closed = [true, false]);
      req.query.range ? (obj.range = JSON.parse(req.query.range)) : "";

      const result = await ticketModel.getAllTickets(
        req.headers.authorization,
        obj
      );

      if (result.name && result.name == "error")
        return res.status(400).send({ error: "There was an error" });

      if (!result && result.length <= 0)
        return res.status(400).send({ error: "There are no tickets" });

      const tickets = [];
      for (const ticket of result) {
        console.log;
        const t = [ticket];
        const ticketFormated = await formatTicketForPhase(
          t,
          req.app.locals.db,
          ticket
        );
        tickets.push(ticketFormated);
      }

      return res.status(200).send(tickets);
    } catch (err) {
      console.log("Error when select ticket by id =>", err);
      return res.status(400).send({ error: "There was an error" });
    }
  }

  async updateTicket(req, res) {
    try {
      let userResponsible = [];

      req.body.responsible.map(async (responsible) => {
        let result;
        result = await userController.checkUserCreated(
          responsible,
          req.headers.authorization,
          responsible.name
        );
        userResponsible.push(result.id);
      });
      let ticket = await ticketModel.getTicketById(
        req.params.id,
        req.headers.authorization
      );

      if (!ticket || ticket.length <= 0)
        return res
          .status(400)
          .send({ error: "There is no ticket with this ID " });

      let obj = {
        ids_crm: req.body.ids_crm,
        id_customer: req.body.id_customer,
        id_protocol: req.body.id_protocol,
        updated_at: moment().format(),
      };

      let result = await ticketModel.updateTicket(
        obj,
        req.params.id,
        req.headers.authorization
      );

      await this._createResponsibles(userResponsible, req.params.id);

      let phase = await phaseModel.getPhase(
        req.body.id_phase,
        req.headers.authorization
      );

      if (!phase || phase.length <= 0)
        return res.status(400).send({ error: "Invalid id_phase uuid" });

      if (ticket[0].phase_id != phase[0].id) {
        await phaseModel.disablePhaseTicket(req.params.id);

        let phase_id = await ticketModel.createPhaseTicket({
          id_phase: phase[0].id,
          id_ticket: req.params.id,
        });
        if (!phase_id || phase_id.length <= 0)
          return res.status(500).send({ error: "There was an error" });
      }

      if (req.body.form && Object.keys(req.body.form).length > 0) {
        const firstPhase = await ticketModel.getFirstFormTicket(ticket[0].id);
        if (firstPhase[0].form) {
          let errors = await this._validateUpdate(
            req.app.locals.db,
            firstPhase[0].id_form_template,
            req.body.form,
            ticket[0].id_form
          );
          if (errors.length > 0)
            return res.status(400).send({ errors: errors });

          console.log("FORM ====>", req.body.form);
          obj.id_form = await new FormDocuments(
            req.app.locals.db
          ).updateRegister(ticket[0].id_form, req.body.form);
        }
      }

      ticket = await formatTicketForPhase(ticket, req.app.locals.db, ticket[0]);
      await redis.set(
        `msTicket:ticket:${req.params.id}`,
        JSON.stringify(ticket)
      );

      await redis.del(`ticket:phase:${req.headers.authorization}`);

      if (result) return res.status(200).send(ticket);

      return res.status(400).send({ error: "There was an error" });
    } catch (err) {
      console.log("Error when generate object to save ticket => ", err);
      return res
        .status(400)
        .send({ error: "Error when generate object to save ticket" });
    }
  }

  async queueUpdateTicket(data) {
    try {
      let userResponsible = [];

      data.responsible.map(async (responsible) => {
        let result;
        result = await userController.checkUserCreated(
          responsible,
          data.authorization,
          responsible.name
        );
        userResponsible.push(result.id);
      });
      let ticket = await ticketModel.getTicketById(
        data.id,
        data.authorization
      );

      if (!ticket || ticket.length <= 0)
        return false

      let obj = {
        ids_crm: data.ids_crm,
        id_customer: data.id_customer,
        id_protocol: data.id_protocol,
        updated_at: moment().format(),
      };

      let result = await ticketModel.updateTicket(
        obj,
        data.id,
        data.authorization
      );

      await this._createResponsibles(userResponsible, data.id);

      let phase = await phaseModel.getPhase(
        data.id_phase,
        data.authorization
      );

      if (!phase || phase.length <= 0)
        return false

      if (ticket[0].phase_id != phase[0].id) {
        await phaseModel.disablePhaseTicket(data.id);

        let phase_id = await ticketModel.createPhaseTicket({
          id_phase: phase[0].id,
          id_ticket: data.id,
        });
        if (!phase_id || phase_id.length <= 0)
          return false
      }

      if (data.form && Object.keys(data.form).length > 0) {
        const firstPhase = await ticketModel.getFirstFormTicket(ticket[0].id);
        if (firstPhase[0].form) {
          let errors = await this._validateUpdate(
            data.app.locals.db,
            firstPhase[0].id_form_template,
            data.form,
            ticket[0].id_form
          );
          if (errors.length > 0)
            return false

          console.log("FORM ====>", data.form);
          obj.id_form = await new FormDocuments(
            data.app.locals.db
          ).updateRegister(ticket[0].id_form, data.form);
        }
      }

      ticket = await formatTicketForPhase(ticket, data.app.locals.db, ticket[0]);
      await redis.set(
        `msTicket:ticket:${data.id}`,
        JSON.stringify(ticket)
      );

      await redis.del(`ticket:phase:${data.authorization}`);

      if (result) return ticket

      return false
    } catch (err) {
      console.log("Error when generate object to save ticket => ", err);
      return false
    }
  }

  async closedTicket(req, res) {
    try {
      const result = await ticketModel.closedTicket(req.params.id);
      if (result && result[0].id) {
        await redis.del(`msTicket:ticket:${result[0].id}`);

        let ticket = await ticketModel.getTicketById(
          req.params.id,
          req.headers.authorization
        );

        ticket[0] = await formatTicketForPhase(
          ticket,
          req.app.locals.db,
          ticket[0]
        );

        return res.status(200).send(ticket[0]);
      }

      await redis.del(`ticket:phase:${req.headers.authorization}`);

      return res.status(400).send({ error: "There was an error" });
    } catch (err) {
      console.log("Error when finaly ticket =>", err);
      return res.status(400).send({ error: "There was an error" });
    }
  }

  async setTicketAtRedis() {
    return new Promise(async (resolve, reject) => {
      await redis.KEYS(`msTicket:ticket:*`, async (err, res) => {
        if (res && res.length > 0) {
          resolve(true);
        } else {
          const tickets = await ticketModel.getAllTicketWhitoutCompanyId();
          if (tickets && tickets.length > 0) {
            for (const ticket of tickets) {
              let result = await ticketModel.getTicketById(
                ticket.id,
                ticket.id_company
              );
              await redis.set(
                `msTicket:ticket:${ticket.id}`,
                JSON.stringify(result[0])
              );
            }
            resolve(true);
          }
        }
      });
    });
  }

  async checkSLATicket() {
    await redis.KEYS(`msTicket:ticket:*`, async (err, res) => {
      if (res && res.length > 0) {
        for (let ticket of res) {
          let result = await redis.get(`${ticket}`);
          result = JSON.parse(result);
          let timeNow = await this.processCase(result);
          if (timeNow >= result.sla_time) {
            await ticketModel.updateSlaTicket(
              { sla: true, updated_at: moment().format() },
              result.id
            );
            const companyInfo = await companyModel.getById(result.id_company);
            const allResponsibles = await ticketModel.getAllResponsibleTicket(
              result.id
            );
            let userResponsibleTicket = [];
            let emailResponsibleTicket = [];
            await allResponsibles.map((value) => {
              if (value.id_user) {
                userResponsibleTicket.push(value.id_user);
              } else if (value.id_email) {
                emailResponsibleTicket.push(value.id_email);
              }
            });
            await this._notify(
              result.phase,
              companyInfo[0].notify_token,
              result.id,
              userResponsibleTicket,
              emailResponsibleTicket,
              result.id_company,
              3,
              req.app.locals.db
            );
          }
        }
        return true;
      } else {
        return true;
      }
    });
  }

  async processCase(result) {
    let ticketTime;
    let timeNow = moment();

    switch (result.unit_of_time) {
      case 1:
        ticketTime = moment(result.updated_at);
        timeNow = timeNow.diff(ticketTime, "seconds");
        break;
      case 2:
        ticketTime = moment(result.updated_at);
        timeNow = timeNow.diff(ticketTime, "minutes");

        break;
      case 3:
        ticketTime = moment(result.updated_at);
        timeNow = timeNow.diff(ticketTime, "hours");
        break;
      case 4:
        ticketTime = moment(result.updated_at);
        timeNow = timeNow.diff(ticketTime, "days");
        break;
      default:
        ticketTime = moment(result.updated_at);
        timeNow = timeNow.diff(ticketTime, "hours");
        break;
    }
    return timeNow;
  }

  async _validateForm(db, id_form_template, form, update = false) {
    try {
      const errors = [];
      const form_template = await new FormTemplate(db).findRegistes(
        id_form_template
      );
      // for (let column of form_template.column) {
      //   column.required && form[column.column]
      //     ? ""
      //     : errors.push(`O campo ${column.label} é obrigatório`);
      // }
      return errors;
    } catch (err) {
      console.log("Error when generate Doc =>", err);
      return err;
    }
  }

  async _validateUpdate(db, id_form_template, form, id_form_ticket) {
    try {
      const errors = [];
      const form_template = await new FormTemplate(db).findRegistes(
        id_form_template
      );
      const form_register = await new FormDocuments(db).findRegister(
        id_form_ticket
      );
      for (let column of form_template.column) {
        column.required && form[column.column]
          ? ""
          : errors.push(`O campo ${column.label} é obrigatório`);

        if (form[column.column] != form_register[column.column])
          !column.editable && form[column.column]
            ? errors.push(`O campo ${column.label} não é editavel`)
            : "";
      }
      return errors;
    } catch (err) {
      console.log("Error when generate Doc =>", err);
      return err;
    }
  }

  async getTicketByCustomerOrProtocol(req, res) {
    try {
      let result = await ticketModel.getTicketByCustomerOrProtocol(
        req.params.id
      );
        console.log("result =====> ", result)
      for (let ticket of result) {
        ticket = await formatTicketForPhase(
          [ticket],
          req.app.locals.db,
          ticket
        );

        ticket.attachments = await attachmentsModel.getAttachments(ticket.id);
        ticket.attachments.map((value) => {
          value.created_at = moment(value.created_at).format(
            "DD/MM/YYYY HH:mm:ss"
          );
          value.updated_at = moment(value.updated_at).format(
            "DD/MM/YYYY HH:mm:ss"
          );
        });

        ticket.activities = await activitiesModel.getActivities(ticket.id);
        ticket.activities.map((value) => {
          value.created_at = moment(value.created_at).format(
            "DD/MM/YYYY HH:mm:ss"
          );
          value.updated_at = moment(value.updated_at).format(
            "DD/MM/YYYY HH:mm:ss"
          );
        });

        ticket.history_phase = await ticketModel.getHistoryTicket(ticket.id);
        ticket.history_phase.map((value) => {
          value.created_at = moment(value.created_at).format(
            "DD/MM/YYYY HH:mm:ss"
          );
        });
      }

      if (!result && result.length <= 0)
        return res.status(400).send({ error: "There was an error" });

      return res.status(200).send(result);
    } catch (err) {
      console.log("====>", err);
      return res.status(400).send({ error: "There was an error" });
    }
  }

  async ticketStatusCount(req, res) {
    try {
      const id_company = req.headers.authorization;
      let result = await ticketModel.getTicketStatusCount(id_company);

      let retorno;
      if (
        result.length &&
        result.length > 0 &&
        result[0].id_company.length > 0
      ) {
        retorno = {
          tickets_abertos: parseInt(result[0].tickets_abertos),
          tickets_respondidos: parseInt(result[0].tickets_respondidos),
          tickets_atrasados: parseInt(result[0].tickets_atrasados),
        };
      } else {
        retorno = {
          tickets_abertos: 0,
          tickets_respondidos: 0,
          tickets_atrasados: 0,
        };
      }

      return res.status(200).json(retorno);
    } catch (err) {
      console.log("status ====>", err);
      return res
        .status(400)
        .send({ error: "There was an error while trying to obtain status" });
    }
  }

  async ticketResponsibleCount(req, res) {
    try {
      const id_company = req.headers.authorization;

      let obj = {};
      req.query.department
        ? (obj.department = JSON.parse(req.query.department))
        : "";
      req.query.users ? (obj.users = JSON.parse(req.query.users)) : "";
      req.query.closed
        ? (obj.closed = JSON.parse(req.query.closed))
        : (obj.closed = [true, false]);
      req.query.range ? (obj.range = JSON.parse(req.query.range)) : "";

      let result = await ticketModel.getCountResponsibleTicket(id_company, obj);

      if (result.name && result.name == "error")
        return res.status(400).send({ error: "There was an error" });

      if (!result && result.length <= 0)
        return res.status(400).send({ error: "There are no tickets" });

      let response = [];
      if (result.length && result.length > 0) {
        for (let obj of result) {
          response.push({
            id_user: obj.id_user,
            count: parseInt(obj.count),
          });
        }
      }

      return res.status(200).json(response);
    } catch (err) {
      console.log("status ====>", err);
      return res
        .status(400)
        .send({ error: "There was an error while trying to obtain status" });
    }
  }
}

module.exports = TicketController;
