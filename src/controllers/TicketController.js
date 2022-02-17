const FormTemplate = require("../documents/FormTemplate");
const FormDocuments = require("../documents/FormDocuments");
const asyncRedis = require("async-redis");
const redis = asyncRedis.createClient(
  process.env.REDIS_PORT,
  process.env.REDIS_HOST
);
const { formatTicketForPhase } = require("../helpers/FormatTicket");
const { validationResult } = require("express-validator");

const moment = require("moment");
const { v1 } = require("uuid");

const UserController = require("./UserController");
const userController = new UserController();

const PhaseModel = require("../models/PhaseModel");
const phaseModel = new PhaseModel();

const CustomerModel = require("../models/CustomerModel");
const customerModel = new CustomerModel();

const TicketModel = require("../models/TicketModel");
const ticketModel = new TicketModel();

const DepartmentController = require("./DepartmentController");
const departmentController = new DepartmentController();

const AttachmentsModel = require("../models/AttachmentsModel");
const attachmentsModel = new AttachmentsModel();

const ActivitiesModel = require("../models/ActivitiesModel");
const activitiesModel = new ActivitiesModel();

const SLAModel = require("../models/SLAModel");
const slaModel = new SLAModel();

const CallbackDigitalk = require("../services/CallbackDigitalk");

const { createSLAControl, updateSLA } = require("../helpers/SLAFormat");
const sla_status = {
  emdia: 1,
  atrasado: 2,
  aberto: 3,
};

const TypeColumnModel = require("../models/TypeColumnModel");
const typeColumnModel = new TypeColumnModel();

const CompanyModel = require("../models/CompanyModel");
const companyModel = new CompanyModel();

const UserModel = require("../models/UserModel");
const userModel = new UserModel();

const cache = require("../helpers/Cache");

class TicketController {
  //Remover assim que função da fila funcionar direitinho
  async create(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    try {
      let id_user = await userController.checkUserCreated(
        req.body.id_user,
        req.headers.authorization,
        req.body.name ? req.body.name : "",
        req.body.phone ? req.body.phone : "",
        req.body.email ? req.body.email : "",
        req.body.type_user ? req.body.type_user : 1
      );

      let obj = {
        id: v1(),
        id_company: req.headers.authorization,
        // ids_crm: req.body.ids_crm,
        // id_customer: req.body.id_customer,
        // id_protocol: req.body.id_protocol,
        id_user: id_user.id,
        created_at: moment().format(),
        updated_at: moment().format(),
        display_name: req.body.display_name,
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
      if (!phase || phase.length <= 0)
        return res.status(400).send({ error: "Invalid id_phase uuid" });

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

      if (req.body.id_ticket_father) {
        const ticketFather = await ticketModel.getTicketById(
          req.body.id_ticket_father
        );
        if (
          ticketFather &&
          Array.isArray(ticketFather) &&
          ticketFather.length > 0
        ) {
          obj.id_ticket_father = ticketFather[0].id;
          obj.created_by_ticket = true;
        }
      }

      if (req.body.id_protocol) {
        obj.id_protocol = req.body.id_protocol;
        obj.created_by_protocol = true;
      }

      let result = await ticketModel.create(obj);

      if (!req.body.display_name || req.body.display_name === "") {
        await ticketModel.updateTicket(
          {
            display_name: `ticket#${result[0].id_seq}`,
          },
          result[0].id,
          req.headers.authorization
        );
      }
      // await this._createResponsibles(userResponsible, obj.id);

      if (req.body.customer) {
        await this._createCustomers(req.body.customer, obj.id);
      }

      let phase_id = await ticketModel.createPhaseTicket({
        id_phase: phase[0].id,
        id_ticket: obj.id,
        id_user: id_user.id,
        id_form: obj.id_form,
      });

      if (!phase_id || phase_id.length <= 0)
        return res.status(500).send({ error: "There was an error" });

      let ticket = await ticketModel.getTicketById(
        obj.id,
        req.headers.authorization
      );
      await redis.set(
        `msTicket:ticket:${ticket.id}`,
        JSON.stringify(ticket[0])
      );

      if (result && result.length > 0 && result[0].id) {
        await createSLAControl(phase[0].id, obj.id);

        ticket = await formatTicketForPhase({ id: phase[0].id }, ticket[0]);

        // delete ticket[0].id_company

        await CallbackDigitalk(
          {
            type: "socket",
            channel: `phase_${phase[0].id}`,
            event: "new_ticket",
            obj: ticket,
          },
          req.company[0].callback
        );

        await this._notify(
          ticket.id,
          phase[0].id,
          req.headers.authorization,
          "open",
          req.company[0].callback
        );
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
    try {
      let userResponsible = [];

      console.log("data =x=>", data);

      const companyVerified = await companyModel.getByIdActive(
        data.authorization
      );

      if (!companyVerified || companyVerified.length <= 0) return false;

      let id_user = await userController.checkUserCreated(
        data.id_user,
        data.authorization,
        data.name ? data.name : "",
        data.phone ? data.phone : "",
        data.email ? data.email : "",
        data.type_user ? data.type_user : 1
      );

      let obj = {
        id: v1(),
        id_company: data.authorization,
        // ids_crm: data.ids_crm,
        // id_customer: data.id_customer,
        // id_protocol: data.id_protocol,
        id_user: id_user.id,
        created_at: moment().format(),
        updated_at: moment().format(),
        display_name: data.display_name,
      };

      if (data.department_origin) {
        let department = await departmentController.checkDepartmentCreated(
          data.department_origin,
          data.authorization
        );
        obj.department_origin = department[0].id;
      }

      let phase = await phaseModel.getPhase(data.id_phase, data.authorization);
      if (!phase || phase.length <= 0) return false;

      if (data.form) {
        //console.log(global.mongodb)
        if (Object.keys(data.form).length > 0) {
          if (phase[0].form) {
            let errors = await this._validateForm(
              global.mongodb,
              phase[0].id_form_template,
              data.form
            );
            if (errors.length > 0) return false;

            obj.id_form = await new FormDocuments(
              global.mongodb
            ).createRegister(data.form);
          }
        }
      }

      if (data.id_ticket_father) {
        const ticketFather = await ticketModel.getTicketById(
          data.id_ticket_father
        );
        if (
          ticketFather &&
          Array.isArray(ticketFather) &&
          ticketFather.length > 0
        ) {
          obj.id_ticket_father = ticketFather[0].id;
          obj.created_by_ticket = true;
        }
      }

      if (data.id_protocol) {
        obj.id_protocol = data.id_protocol;
        obj.created_by_protocol = true;
      }

      let result = await ticketModel.create(obj);

      if (!data.display_name || data.display_name === "") {
        await ticketModel.updateTicket(
          {
            display_name: `ticket#${result[0].id_seq}`,
          },
          result[0].id,
          data.authorization
        );
      }
      // await this._createResponsibles(userResponsible, obj.id);

      if (data.customer) {
        await this._createCustomers(data.customer, obj.id);
      }

      let phase_id = await ticketModel.createPhaseTicket({
        id_phase: phase[0].id,
        id_ticket: obj.id,
        id_user: id_user.id,
        id_form: obj.id_form,
      });

      if (!phase_id || phase_id.length <= 0) return false;

      let ticket = await ticketModel.getTicketById(obj.id, data.authorization);
      await redis.set(
        `msTicket:ticket:${ticket.id}`,
        JSON.stringify(ticket[0])
      );

      if (result && result.length > 0 && result[0].id) {
        ticket = await formatTicketForPhase({ id: phase[0].id }, ticket[0]);

        const dashPhase = await phaseModel.getPhaseById(
          ticket.phase_id,
          data.authorization
        );
        await cache(
          data.authorization,
          dashPhase[0].id_department,
          ticket.phase_id
        );

        await CallbackDigitalk(
          {
            type: "socket",
            channel: `phase_${phase[0].id}`,
            event: "new_ticket",
            obj: ticket,
          },
          companyVerified[0].callback
        );
        await this._notify(
          ticket.id,
          phase[0].id,
          data.authorization,
          "open",
          companyVerified[0].callback
        );
        // delete ticket[0].id_company
        return ticket;
      }
      await redis.del(`ticket:phase:${data.authorization}`);

      return false;
    } catch (err) {
      console.log("Error when generate object to save ticket => ", err);
      return false;
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

  async _createCustomers(customer = null, ticket_id) {
    try {
      // await customerModel.delCustomerTicket(ticket_id);
      // if (customer.length > 0) {
      //   for (let c of customer) {
      await customerModel.create({
        id_core: customer.id_core,
        id_ticket: ticket_id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        identification_document: customer.identification_document,
        crm_ids: customer.crm_ids,
        crm_contact_id: customer.crm_contact_id,
        created_at: moment().format(),
        updated_at: moment().format(),
      });
      //   }
      // }
      return true;
    } catch (err) {
      console.log("Error when create responsibles ==> ", err);
      return false;
    }
  }

  async _notify(id_ticket, id_phase, id_company, action, callback) {
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

    switch (action) {
      case "open":
        obj = {
          ...obj,
          message: `
        Uma atividade foi criada\n\n
        Identificador da atividade: ${ticket[0].id_seq}\n${
            ticket[0].id_protocol
              ? `\n        Protocolo: ${ticket[0].id_protocol}\n`
              : ""
          }
        Fase: ${phase[0].name}\n
        Data de criação: ${moment().format("DD/MM/YYYY")}\n
        Hora: ${moment().format("HH:mm:ss")}
        `,
        };
        if (phase[0].customer && phase[0].customer.notify_open) {
          obj = {
            ...obj,
            notified: "customer",
          };
          if (phase[0].customer.notify_open_message)
            obj.message = phase[0].customer.notify_open_message;
          if (phase[0].customer.notify_open_hsm)
            obj.hsm_id = phase[0].customer.notify_open_hsm;

          await CallbackDigitalk(obj, callback);
        }

        if (phase[0].admin && phase[0].admin.notify_open) {
          if (phase[0].customer && phase[0].customer.notify_open) {
            obj = { ...obj, notified: "admin" };
            await CallbackDigitalk(obj, callback);
          }
        }

        if (phase[0].separate && phase[0].separate.separate.length > 0) {
          for (const separate of phase[0].separate.separate) {
            if (separate.notify_open) {
              const email = separate.contact.filter((x) => x.email);
              const phone = separate.contact.filter((x) => x.phone);

              obj = {
                ...obj,
                notified: "separate",
                email: email.length > 0 ? email[0].email : "",
                phone: phone.length > 0 ? phone[0].phone : "",
              };
              await CallbackDigitalk(obj, callback);
            }
          }
        }

        break;
      case "progress":
        obj = {
          ...obj,
          message: `
        Uma atividade foi atualizada\n\n
        Identificador da atividade: ${ticket[0].id_seq}\n${
            ticket[0].id_protocol
              ? `\n        Protocolo: ${ticket[0].id_protocol}\n`
              : ""
          }
        Fase: ${phase[0].name}\n
        Data de Atualização: ${moment().format("DD/MM/YYYY")}\n
        Hora: ${moment().format("HH:mm:ss")}
        `,
        };
        if (phase[0].customer && phase[0].customer.notify_progress) {
          obj = {
            ...obj,
            notified: "customer",
          };
          if (phase[0].customer.notify_progress_message)
            obj.message = phase[0].customer.notify_progress_message;
          if (phase[0].customer.notify_progress_hsm)
            obj.hsm_id = phase[0].customer.notify_progress_hsm;

          await CallbackDigitalk(obj, callback);
        }

        if (phase[0].admin && phase[0].admin.notify_progress) {
          if (phase[0].customer && phase[0].customer.notify_open) {
            obj = { ...obj, notified: "admin" };
            await CallbackDigitalk(obj, callback);
          }
        }

        if (phase[0].separate && phase[0].separate.separate.length > 0) {
          for (const separate of phase[0].separate.separate) {
            if (separate.notify_open && separate.contact && separate.contact.length > 0) {
              const email = separate.contact.filter((x) => x.email);
              const phone = separate.contact.filter((x) => x.phone);

              obj = {
                ...obj,
                notified: "separate",
                email: email.length > 0 ? email[0].email : "",
                phone: phone.length > 0 ? phone[0].phone : "",
              };
              await CallbackDigitalk(obj, callback);
            }
          }
        }

        break;
      case "close":
        obj = {
          ...obj,
          message: `
        Uma atividade foi finalizada\n\n
        Identificador da atividade: ${ticket[0].id_seq}\n${
            ticket[0].id_protocol
              ? `\n        Protocolo: ${ticket[0].id_protocol}\n`
              : ""
          }
        Fase: ${phase[0].name}\n
        Data de Abertura:${moment(ticket[0].created_at).format("DD/MM/YYYY")}\n
        Hora de Abertura:${moment(ticket[0].created_at).format("HH:mm:ss")}\n
        Data de Finalização: ${moment().format("DD/MM/YYYY")}\n
        Hora: ${moment().format("HH:mm:ss")}
        `,
        };
        if (phase[0].customer && phase[0].customer.notify_close) {
          obj = {
            ...obj,
            notified: "customer",
          };
          if (phase[0].customer.notify_close_message)
            obj.message = phase[0].customer.notify_close_message;
          if (phase[0].customer.notify_close_hsm)
            obj.hsm_id = phase[0].customer.notify_close_hsm;

          await CallbackDigitalk(obj, callback);
        }

        if (phase[0].admin && phase[0].admin.notify_close) {
          if (phase[0].customer && phase[0].customer.notify_open) {
            obj = { ...obj, notified: "admin" };
            await CallbackDigitalk(obj, callback);
          }
        }

        if (phase[0].separate && phase[0].separate.separate.length > 0) {
          for (const separate of phase[0].separate.separate) {
            if (separate.notify_close) {
              const email = separate.contact.filter((x) => x.email);
              const phone = separate.contact.filter((x) => x.phone);

              obj = {
                ...obj,
                notified: "separate",
                email: email.length > 0 ? email[0].email : "",
                phone: phone.length > 0 ? phone[0].phone : "",
              };
              await CallbackDigitalk(obj, callback);
            }
          }
        }
        break;
      case "start_activity":
        obj = {
          ...obj,
          message: `
        Uma atividade foi iniciada\n\n
        Identificador da atividade: ${ticket[0].id_seq}\n${
            ticket[0].id_protocol
              ? `\n        Protocolo: ${ticket[0].id_protocol}\n`
              : ""
          }
        Fase: ${phase[0].name}\n
        Data de Abertura:${moment(ticket[0].created_at).format("DD/MM/YYYY")}\n
        Hora de Abertura:${moment(ticket[0].created_at).format("HH:mm:ss")}\n
        Data de Inicialização: ${moment().format("DD/MM/YYYY")}\n
        Hora: ${moment().format("HH:mm:ss")}
        `,
        };
        if (phase[0].customer && phase[0].customer.notify_start_activity) {
          obj = {
            ...obj,
            notified: "customer",
          };
          if (phase[0].customer.notify_start_activity_message)
            obj.message = phase[0].customer.notify_start_activity_message;
          if (phase[0].customer.notify_start_activity_hsm)
            obj.hsm_id = phase[0].customer.notify_start_activity_hsm;

          await CallbackDigitalk(obj, callback);
        }

        if (phase[0].admin && phase[0].admin.notify_start_activity) {
          if (phase[0].customer && phase[0].customer.notify_open) {
            obj = { ...obj, notified: "admin" };
            await CallbackDigitalk(obj, callback);
          }
        }

        if (phase[0].separate && phase[0].separate.separate.length > 0) {
          for (const separate of phase[0].separate.separate) {
            if (separate.contact && separate.contact.length > 0 && separate.notify_start_activity ) {
              const email = separate.contact.filter((x) => x.email);
              const phone = separate.contact.filter((x) => x.phone);

              obj = {
                ...obj,
                notified: "separate",
                email: email.length > 0 ? email[0].email : "",
                phone: phone.length > 0 ? phone[0].phone : "",
              };
              await CallbackDigitalk(obj, callback);
            }
          }
        }
        break;
      case "first_reply":
        obj = {
          ...obj,
          message: `
        Um atividade foi respondida\n\n
        Identificador da atividade: ${ticket[0].id_seq}\n${
            ticket[0].id_protocol
              ? `\n        Protocolo: ${ticket[0].id_protocol}\n`
              : ""
          }
        Fase: ${phase[0].name}\n
        Data de Inicialização: ${moment().format("DD/MM/YYYY")}\n
        Hora: ${moment().format("HH:mm:ss")}
        `,
        };
        if (phase[0].customer && phase[0].customer.notify_first_reply) {
          obj = {
            ...obj,
            notified: "customer",
          };

          if (phase[0].customer.notify_start_activity_message)
            obj.message = phase[0].customer.notify_start_activity_message;
          if (phase[0].customer.notify_start_activity_hsm)
            obj.hsm_id = phase[0].customer.notify_start_activity_hsm;

          await CallbackDigitalk(obj, callback);
        }

        if (phase[0].admin && phase[0].admin.notify_first_reply) {
          if (phase[0].customer && phase[0].customer.notify_open) {
            obj = { ...obj, notified: "admin" };
            await CallbackDigitalk(obj, callback);
          }
        }

        if (phase[0].separate && phase[0].separate.separate.length > 0) {
          for (const separate of phase[0].separate.separate) {
            if (separate.notify_first_reply) {
              const email = separate.contact.filter((x) => x.email);
              const phone = separate.contact.filter((x) => x.phone);

              obj = {
                ...obj,
                notified: "separate",
                email: email.length > 0 ? email[0].email : "",
                phone: phone.length > 0 ? phone[0].phone : "",
              };
              await CallbackDigitalk(obj, callback);
            }
          }
        }
        break;
      default:
        console.log("action unmapped");
        break;
    }
  }
  //Remover assim que função da fila funcionar direitinho
  async createActivities(req, res) {
    try {
      if (!req.body.id_user)
        return res.status(400).send({ error: "Whitout id_user" });

      let user = await userController.checkUserCreated(
        req.body.id_user,
        req.headers.authorization,
        req.body.name ? req.body.name : "",
        req.body.phone ? req.body.phone : "",
        req.body.email ? req.body.email : "",
        req.body.type_user ? req.body.type_user : 1
      );

      if (!user || !user.id)
        return res.status(400).send({ error: "There was an error" });

      let ticket = await ticketModel.getTicketById(
        req.body.id_ticket,
        req.headers.authorization
      );
      if (!ticket || ticket.length <= 0)
        return res.status(400).send({ error: "ID ticket is invalid" });

      if (!ticket[0].start_ticket) {
        await this._notify(
          ticket[0].id,
          ticket[0].phase_id,
          req.headers.authorization,
          "start_activity",
          req.company[0].callback
        );

        await ticketModel.updateTicket(
          { start_ticket: moment(), id_status: 2 },
          req.body.id_ticket,
          req.headers.authorization
        );
      }

      let obj = {
        text: req.body.text,
        id_ticket: req.body.id_ticket,
        id_user: user.id,
        created_at: moment().format(),
        updated_at: moment().format(),
      };

      let result = await activitiesModel.create(obj);

      if (result && result.length > 0) {
        await updateSLA(req.body.id_ticket, ticket[0].phase_id, true);

        obj = {
          id: result[0].id,
          message: req.body.text,
          id_user: req.body.id_user,
          type: "note",
          source: user.source,
          name: user.name,
          created_at: moment(obj.created_at).format("DD/MM/YYYY HH:mm:ss"),
          updated_at: moment(obj.updated_at).format("DD/MM/YYYY HH:mm:ss"),
        };

        await CallbackDigitalk(
          {
            type: "socket",
            channel: `ticket_${ticket[0].id}`,
            event: "activity",
            obj,
          },
          req.company[0].callback
        );

        await this._notify(
          ticket[0].id,
          ticket[0].phase_id,
          req.headers.authorization,
          "first_reply",
          req.company[0].callback
        );
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
      const companyVerified = await companyModel.getByIdActive(
        data.authorization
      );

      if (!companyVerified || companyVerified.length <= 0) return false;

      if (!data.id_user) return false;

      let user = await userController.checkUserCreated(
        data.id_user,
        data.authorization,
        data.name ? data.name : "",
        data.phone ? data.phone : "",
        data.email ? data.email : "",
        data.type_user ? data.type_user : 1
      );

      if (!user || !user.id) return false;

      let ticket = await ticketModel.getTicketById(
        data.id_ticket,
        data.authorization
      );
      if (!ticket || ticket.length <= 0) return false;

      if (!ticket[0].start_ticket) {
        await this._notify(
          ticket[0].id,
          ticket[0].phase_id,
          data.authorization,
          "start_activity",
          companyVerified[0].callback
        );

        await ticketModel.updateTicket(
          { start_ticket: moment(), id_status: 2 },
          data.id_ticket,
          data.authorization
        );
      }

      let obj = {
        text: data.text,
        id_ticket: data.id_ticket,
        id_user: user.id,
        created_at: moment().format(),
        updated_at: moment().format(),
      };

      let result = await activitiesModel.create(obj);
      console.log("teste");
      if (result && result.length > 0) {
        await updateSLA(data.id_ticket, ticket[0].phase_id, true);

        obj = {
          id: result[0].id,
          id_seq: ticket[0].id_seq,
          message: data.text,
          id_user: data.id_user,
          type: "note",
          source: user.source,
          name: user.name,
          created_at: moment(obj.created_at).format("DD/MM/YYYY HH:mm:ss"),
          updated_at: moment(obj.updated_at).format("DD/MM/YYYY HH:mm:ss"),
        };

        const dashPhase = await phaseModel.getPhaseById(
          ticket[0].phase_id,
          data.authorization
        );
        await cache(
          data.authorization,
          dashPhase[0].id_department,
          ticket[0].phase_id
        );

        await CallbackDigitalk(
          {
            type: "socket",
            channel: `ticket_${ticket[0].id}`,
            event: "activity",
            obj,
          },
          companyVerified[0].callback
        );

        await this._notify(
          ticket[0].id,
          ticket[0].phase_id,
          data.authorization,
          "first_reply",
          companyVerified[0].callback
        );
        return obj;
      }

      return false;
    } catch (err) {
      console.log("Error manage object to create activities => ", err);
      return false;
    }
  }
  //Remover assim que função da fila funcionar direitinho
  async createAttachments(req, res) {
    try {
      if (!req.body.id_user)
        return res.status(400).send({ error: "Whitout id_user" });

      let user = await userController.checkUserCreated(
        req.body.id_user,
        req.headers.authorization,
        req.body.name ? req.body.name : "",
        req.body.phone ? req.body.phone : "",
        req.body.email ? req.body.email : "",
        req.body.type_user ? req.body.type_user : 1
      );

      if (!user || !user.id)
        return res.status(400).send({ error: "There was an error" });

      let ticket = await ticketModel.getTicketById(
        req.body.id_ticket,
        req.headers.authorization
      );
      if (!ticket || ticket.length <= 0)
        return res.status(400).send({ error: "ID ticket is invalid" });

      if (!ticket[0].start_ticket) {
        await this._notify(
          ticket[0].id,
          ticket[0].phase_id,
          req.headers.authorization,
          "start_activity",
          req.company[0].callback
        );

        await ticketModel.updateTicket(
          { start_ticket: moment(), id_status: 2 },
          req.body.id_ticket,
          req.headers.authorization
        );
      }

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

      await updateSLA(req.body.id_ticket, ticket[0].phase_id, true);

      if (result && result.length > 0) {
        obj.id = result[0].id;

        obj.created_at = moment(obj.created_at).format("DD/MM/YYYY HH:mm:ss");
        obj.updated_at = moment(obj.updated_at).format("DD/MM/YYYY HH:mm:ss");
        obj.type = "file";
        obj.id_user = req.body.id_user;
        await CallbackDigitalk(
          {
            type: "socket",
            channel: `ticket_${ticket[0].id}`,
            event: "activity",
            obj: obj,
          },
          req.company[0].callback
        );

        await this._notify(
          ticket[0].id,
          ticket[0].phase_id,
          req.headers.authorization,
          "first_reply",
          req.company[0].callback
        );
        return res.status(200).send(obj);
      }

      return res.status(400).send({ error: "There was an error" });
    } catch (err) {
      console.log("Error manage object to create attachments => ", err);
      return res.status(400).send({ error: "There was an error" });
    }
  }

  async queueCreateAttachments(data) {
    try {
      const companyVerified = await companyModel.getByIdActive(
        data.authorization
      );

      if (!companyVerified || companyVerified.length <= 0) return false;

      if (!data.id_user) return false;

      let user = await userController.checkUserCreated(
        data.id_user,
        data.authorization,
        data.name ? data.name : "",
        data.phone ? data.phone : "",
        data.email ? data.email : "",
        data.type_user ? data.type_user : 1
      );

      if (!user || !user.id) return false;

      let ticket = await ticketModel.getTicketById(
        data.id_ticket,
        data.authorization
      );
      if (!ticket || ticket.length <= 0) return false;

      if (!ticket[0].start_ticket) {
        await this._notify(
          ticket[0].id,
          ticket[0].phase_id,
          data.authorization,
          "start_activity",
          companyVerified[0].callback
        );

        await ticketModel.updateTicket(
          { start_ticket: moment(), id_status: 2 },
          data.id_ticket,
          data.authorization
        );
      }

      let typeAttachments = await ticketModel.getTypeAttachments(data.type);

      if (!typeAttachments || typeAttachments.length <= 0) return false;

      let obj = {
        id_user: user.id,
        id_ticket: data.id_ticket,
        url: data.url,
        type: typeAttachments[0].id,
        name: data.name,
        created_at: moment(),
        updated_at: moment(),
      };

      let result = await attachmentsModel.create(obj);

      await updateSLA(data.id_ticket, ticket[0].phase_id, true);

      if (result && result.length > 0) {
        obj.id = result[0].id;

        obj.created_at = moment(obj.created_at).format("DD/MM/YYYY HH:mm:ss");
        obj.updated_at = moment(obj.updated_at).format("DD/MM/YYYY HH:mm:ss");
        obj.type = "file";
        obj.id_user = data.id_user;

        const dashPhase = await phaseModel.getPhaseById(
          ticket[0].phase_id,
          data.authorization
        );
        await cache(
          data.authorization,
          dashPhase[0].id_department,
          ticket[0].phase_id
        );

        await CallbackDigitalk(
          {
            type: "socket",
            channel: `ticket_${ticket[0].id}`,
            event: "activity",
            obj: obj,
          },
          companyVerified[0].callback
        );

        await this._notify(
          ticket[0].id,
          ticket[0].phase_id,
          data.authorization,
          "first_reply",
          companyVerified[0].callback
        );
        return true;
      }

      return false;
    } catch (err) {
      console.log("Error manage object to create attachments => ", err);
      return res.status(400).send({ error: "There was an error" });
    }
  }

  async getTicketByID(req, res) {
    try {
      let result = await ticketModel.getTicketByIdSeq(
        req.params.id,
        req.headers.authorization
      );
      if (result.name && result.name == "error")
        return res.status(400).send({ error: "There was an error" });

      if (result && result.length <= 0)
        return res
          .status(400)
          .send({ error: "There is no ticket with this ID" });

      result = await formatTicketForPhase(
        { id: result[0].phase_id },
        result[0]
      );
      const customer = await customerModel.getAll(result.id);
      if (customer && Array.isArray(customer) && customer.length > 0) {
        result.customers = customer;
      }

      const protocols = await ticketModel.getProtocolTicket(
        result.id,
        req.headers.authorization
      );
      console.log("protocols =>", protocols);

      if (protocols && Array.isArray(protocols) && protocols.length > 0) {
        result.protocols = protocols;
      }

      result.activities = await this._activities(
        result.id,
        req.app.locals.db,
        req.headers.authorization
      );

      result.activities.sort((a, b) => {
        if (
          moment(a.created_at, "DD/MM/YYYY HH:mm:ss").format("X") ===
          moment(b.created_at, "DD/MM/YYYY HH:mm:ss").format("X")
        ) {
          return a.id;
        } else {
          return (
            moment(a.created_at, "DD/MM/YYYY HH:mm:ss").format("X") -
            moment(b.created_at, "DD/MM/YYYY HH:mm:ss").format("X")
          );
        }
      });

      const department = await phaseModel.getDepartmentPhase(result.phase_id);
      result.actual_department = department[0].id_department;

      const form = await ticketModel.getFormTicket(result.id);

      if (form && form.length > 0 && form[0].id_form) {
        const phase = await phaseModel.getPhaseById(
          form[0].id_phase,
          req.headers.authorization
        );
        if (phase[0].form && phase[0].id_form_template) {
          const register = await new FormTemplate(
            req.app.locals.db
          ).findRegistes(phase[0].id_form_template);

          if (register && register.column) {
            result.form_template = register.column;

            for (const x of result.form_template) {
              const type = await typeColumnModel.getTypeByID(x.type);

              type && Array.isArray(type) && type.length > 0
                ? (x.type = type[0].name)
                : "";
            }
          }
        }
        result.form_data = await new FormDocuments(
          req.app.locals.db
        ).findRegister(form[0].id_form);
        delete result.form_data._id;
      }
      console.log("result =>", result);
      return res.status(200).send(result);
    } catch (err) {
      console.log("Error when select ticket by id =>", err);
      return res.status(400).send({ error: "There was an error" });
    }
  }

  async getTicket(req, res) {
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

      result = await formatTicketForPhase(
        { id: result[0].phase_id },
        result[0]
      );
      const customer = await customerModel.getAll(result.id);
      if (customer && Array.isArray(customer) && customer.length > 0) {
        result.customers = customer;
      }

      const protocols = await ticketModel.getProtocolTicket(
        result.id,
        req.headers.authorization
      );
      console.log("protocols =>", protocols);
      if (protocols && Array.isArray(protocols) && protocols.length > 0) {
        result.protocols = protocols[0];
      }

      result.activities = await this._activities(
        result.id,
        req.app.locals.db,
        req.headers.authorization
      );

      result.activities.sort((a, b) => {
        if (
          moment(a.created_at, "DD/MM/YYYY HH:mm:ss").format("X") ===
          moment(b.created_at, "DD/MM/YYYY HH:mm:ss").format("X")
        ) {
          return a.id;
        } else {
          return (
            moment(a.created_at, "DD/MM/YYYY HH:mm:ss").format("X") -
            moment(b.created_at, "DD/MM/YYYY HH:mm:ss").format("X")
          );
        }
      });

      const department = await phaseModel.getDepartmentPhase(result.phase_id);
      result.actual_department = department[0].id_department;

      const form = await ticketModel.getFormTicket(result.id);

      if (form && form.length > 0 && form[0].id_form) {
        const phase = await phaseModel.getPhaseById(
          form[0].id_phase,
          req.headers.authorization
        );
        if (phase[0].form && phase[0].id_form_template) {
          const register = await new FormTemplate(
            req.app.locals.db
          ).findRegistes(phase[0].id_form_template);

          if (register && register.column) {
            result.form_template = register.column;

            for (const x of result.form_template) {
              const type = await typeColumnModel.getTypeByID(x.type);

              type && Array.isArray(type) && type.length > 0
                ? (x.type = type[0].name)
                : "";
            }
          }
        }
        result.form_data = await new FormDocuments(
          req.app.locals.db
        ).findRegister(form[0].id_form);
        delete result.form_data._id;
      }

      return res.status(200).send(result);
    } catch (err) {
      console.log("Error when select ticket by id =>", err);
      return res.status(400).send({ error: "There was an error" });
    }
  }

  async _activities(id_ticket, db, id_company) {
    const obj = [];

    const activities = await activitiesModel.getActivities(id_ticket);
    activities.map((value) => {
      value.created_at = moment(value.created_at).format("DD/MM/YYYY HH:mm:ss");
      value.updated_at = moment(value.updated_at).format("DD/MM/YYYY HH:mm:ss");
      value.type = "note";
      obj.push(value);
    });

    const attachments = await attachmentsModel.getAttachments(id_ticket);
    attachments.map((value) => {
      value.created_at = moment(value.created_at).format("DD/MM/YYYY HH:mm:ss");
      value.updated_at = moment(value.updated_at).format("DD/MM/YYYY HH:mm:ss");
      value.type = "file";
      obj.push(value);
    });

    let history_phase = await ticketModel.getHistoryTicket(id_ticket);
    for (let index in history_phase) {
      index = parseInt(index);

      if (history_phase[index + 1]) {
        const before = await new FormDocuments(db).findRegister(
          history_phase[index].id_form
        );

        const templateBefore = await new FormTemplate(db).findRegistes(
          history_phase[index].template
        );
        console.log("templateBefore =>", templateBefore);
        const after = await new FormDocuments(db).findRegister(
          history_phase[index + 1].id_form
        );

        const templateAfter = await new FormTemplate(db).findRegistes(
          history_phase[index + 1].template
        );
        console.log("created at ----->",history_phase[index + 1])
        obj.push({
          before: {
            phase: history_phase[index + 1].id_phase,
            field: templateAfter ? templateAfter.column : {},
            value: after,
          },
          after: {
            phase: history_phase[index].id_phase,
            field: templateBefore ? templateBefore.column : {},
            value: before,
          },
          type: "change_form",
          id_user: history_phase[index].id_user,
          created_at: moment(history_phase[index].created_at).format(
            "DD/MM/YYYY HH:mm:ss"
          ),
          updated_at: moment(history_phase[index].updated_at).format(
            "DD/MM/YYYY HH:mm:ss"
          ),
        });

        if (
          history_phase[index].id_phase != history_phase[index + 1].id_phase
        ) {
          obj.push({
            type: "move",
            id_user: history_phase[index].id_user,
            phase_dest: {
              id: history_phase[index].id_phase,
              name: history_phase[index].name,
            },
            phase_origin: {
              id: history_phase[index + 1].id_phase,
              name: history_phase[index + 1].name,
            },
            created_at: moment(history_phase[index].created_at).format(
              "DD/MM/YYYY HH:mm:ss"
            ),
          });
        }
      }
      const slas = await slaModel.getSLAControl(
        history_phase[index].id_phase,
        id_ticket
      );
      for (const sla of slas) {
        obj.push({
          id_phase: history_phase[index].id_phase,
          name: history_phase[index].name,
          status: sla.status,
          id_sla_status: sla.id_sla_status,
          sla_type: sla.type,
          id_sla_type: sla.id_sla_type,
          limit_sla_time: moment(sla.limit_sla_time).format(
            "DD/MM/YYYY HH:mm:ss"
          ),
          interaction_time: sla.interaction_time
            ? moment(sla.interaction_time).format("DD/MM~/YYYY HH:mm:ss")
            : "",
          created_at: sla.created_at
            ? moment(sla.created_at).format("DD/MM/YYYY HH:mm:ss")
            : moment(history_phase[index + 1].updated_at).format(
                "DD/MM/YYYY HH:mm:ss"
              ),
          type: "sla",
        });
      }
    }

    const view_ticket = await ticketModel.getViewTicket(id_ticket);
    view_ticket.map((value) => {
      value.start = moment(value.start).format("DD/MM/YYYY HH:mm:ss");
      value.end
        ? (value.end = moment(value.end).format("DD/MM/YYYY HH:mm:ss"))
        : "";
      value.created_at = value.start;
      value.type = "view";
      obj.push(value);
    });
    // await history_phase.map(async (value, index, array) => {
    //   if (array[index + 1]) {
    //     console.log("array[index + 1]", array[index + 1]);
    //     const before = await new FormDocuments(db).findRegister(value.id_form);
    //     const after = await new FormDocuments(db).findRegister(
    //       array[index + 1].id_form
    //     );
    //     obj.push({
    //       after: after,
    //       before: before,
    //       type: "form",
    //       created_at: array[index + 1].created_at,
    //     });
    //     console.log("TESTE ===>", obj);
    //   }
    //   value.created_at = moment(value.created_at).format("DD/MM/YYYY HH:mm:ss");
    // });

    const create_protocol = await ticketModel.getProtocolCreatedByTicket(
      id_ticket,
      id_company
    );
    create_protocol.map((value) => {
      value.created_at = moment(value.created_at).format("DD/MM/YYYY HH:mm:ss");
      value.updated_at = moment(value.updated_at).format("DD/MM/YYYY HH:mm:ss");
      value.type = "create_protocol";
      obj.push(value);
    });

    const create_ticket = await ticketModel.getTicketCreatedByTicketFather(
      id_ticket,
      id_company
    );
    create_ticket.map((value) => {
      value.created_at = moment(value.created_at).format("DD/MM/YYYY HH:mm:ss");
      value.type = "create_ticket";
      obj.push(value);
    });

    const ticket = await ticketModel.getStatusTicketById(id_ticket, id_company);
    if (ticket[0].created_by_ticket) {
      const ticketFather = await ticketModel.getTicketById(
        ticket[0].id_ticket_father
      );
      obj.push({
        type: "start",
        created_at: moment(ticket[0].created_at).format("DD/MM/YYYY HH:mm:ss"),
        ticket: ticketFather[0].id_seq,
        id_user: ticket[0].id_user,
      });
    } else if (ticket[0].created_by_protocol) {
      obj.push({
        type: "start",
        created_at: moment(ticket[0].created_at).format("DD/MM/YYYY HH:mm:ss"),
        protocol: ticket[0].id_protocol,
        id_user: ticket[0].id_user,
      });
    } else {
      obj.push({
        type: "start",
        created_at: moment(ticket[0].created_at).format("DD/MM/YYYY HH:mm:ss"),
        id_user: ticket[0].id_user,
      });
    }
    if (ticket[0].status === 3 && ticket[0].user_closed_ticket) {
      const user = await userModel.getById(
        ticket[0].user_closed_ticket,
        id_company
      );
      obj.push({
        type: "closed",
        created_at: moment(ticket[0].time_closed_ticket).format(
          "DD/MM/YYYY HH:mm:ss"
        ),
        id_user: user[0].id_users,
      });
    }

    return obj;
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
        const ticketFormated = await formatTicketForPhase(
          { id: ticket.id_phase },
          ticket
        );
        // sla formatado dessa forma para apresentar no analitico do ticket. favor não mexer sem consultar o Rafael ou o Silas.
        if (ticketFormated.sla) {
          const keys = Object.keys(ticketFormated.sla);
          if (keys.length > 0) {
            const sla = keys.pop();
            ticketFormated.countSLA = ticketFormated.sla[sla].status;
            ticketFormated.sla_time = ticketFormated.sla[sla].limit_sla_time;
          }
        }
        tickets.push(ticketFormated);
      }

      return res.status(200).send(tickets);
    } catch (err) {
      console.log("Error when select ticket by id =>", err);
      return res.status(400).send({ error: "There was an error" });
    }
  }

  //Remover assim que função da fila funcionar direitinho
  async updateTicket(req, res) {
    try {
      let obj = {
        // ids_crm: req.body.ids_crm,
        // id_customer: req.body.id_customer,
        // id_protocol: req.body.id_protocol,
        updated_at: moment().format(),
        display_name: req.body.display_name,
      };

      let ticket = await ticketModel.getTicketById(
        req.params.id,
        req.headers.authorization
      );

      if (!ticket || ticket.length <= 0)
        return res
          .status(400)
          .send({ error: "There is no ticket with this ID " });

      ticket = await formatTicketForPhase(ticket, ticket[0]);

      if (ticket.id_status === 3)
        return res
          .status(400)
          .send({ error: "Impossivel atualizar um ticket finalizado!" });
      // if (req.body.customer) {
      //   await this._createCustomers(req.body.customer, req.params.id);
      // }

      let phase = await phaseModel.getPhase(
        req.body.id_phase,
        req.headers.authorization
      );

      if (!phase || phase.length <= 0)
        return res.status(400).send({ error: "Invalid id_phase uuid" });

      await updateSLA(ticket.id, ticket.phase_id);
      if (ticket.phase_id != phase[0].id) {
        await phaseModel.disablePhaseTicket(req.params.id);
        await slaModel.disableSLA(req.params.id);

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
        const user = await userController.checkUserCreated(
          req.body.id_user,
          req.headers.authorization,
          req.body.name ? req.body.name : "",
          req.body.phone ? req.body.phone : "",
          req.body.email ? req.body.email : "",
          req.body.type_user ? req.body.type_user : 1
        );
        let phase_id = await ticketModel.createPhaseTicket({
          id_phase: phase[0].id,
          id_ticket: req.params.id,
          id_user: user.id,
          id_form: obj.id_form,
        });
        if (!phase_id || phase_id.length <= 0)
          return res.status(500).send({ error: "There was an error" });

        await createSLAControl(phase[0].id, req.params.id);

        await CallbackDigitalk(
          {
            type: "socket",
            channel: `phase_${ticket.phase_id}`,
            event: "move_ticket_old_phase",
            obj: { id: ticket.id, id_phase: ticket.phase_id },
          },
          req.company[0].callback
        );

        await CallbackDigitalk(
          {
            type: "socket",
            channel: `phase_${phase[0].id}`,
            event: "move_ticket_new_phase",
            obj: { ...ticket, phase_id: phase[0].id },
          },
          req.company[0].callback
        );

        await CallbackDigitalk(
          {
            type: "socket",
            channel: `ticket_${ticket.id}`,
            event: "activity",
            obj: {
              type: "move",
              id_user: req.body.id_user,
              phase_dest: {
                id: phase[0].id,
                name: phase[0].name,
              },
              phase_origin: {
                id: ticket.phase_id,
                name: ticket.phase,
              },
              created_at: moment().format("DD/MM/YYYY HH:mm:ss"),
            },
          },
          req.company[0].callback
        );
      } else {
        if (req.body.form && Object.keys(req.body.form).length > 0) {
          const firstPhase = await ticketModel.getFirstFormTicket(ticket[0].id);
          if (firstPhase[0].form) {
            let errors = await this._validateUpdate(
              req.app.locals.db,
              firstPhase[0].id_form_template,
              req.body.form,
              firstPhase[0].id_form
            );
            if (errors.length > 0)
              return res.status(400).send({ errors: errors });

            await new FormDocuments(req.app.locals.db).updateRegister(
              firstPhase[0].id_form,
              req.body.form
            );
          }
        }
      }

      await this._notify(
        ticket.id,
        phase[0].id,
        req.headers.authorization,
        "progress",
        req.company[0].callback
      );
      if (!ticket.start_ticket) {
        await this._notify(
          ticket.id,
          phase[0].id,
          req.headers.authorization,
          "start_activity",
          req.company[0].callback
        );

        obj.start_ticket = moment();
        obj.id_status = 2;
      }
      delete obj.id_form;
      let result = await ticketModel.updateTicket(
        obj,
        req.params.id,
        req.headers.authorization
      );

      await redis.set(
        `msTicket:ticket:${req.params.id}`,
        JSON.stringify(ticket)
      );

      await CallbackDigitalk(
        {
          type: "socket",
          channel: `phase_${req.body.id_phase}`,
          event: "update_ticket",
          obj: ticket,
        },
        req.company[0].callback
      );

      await CallbackDigitalk(
        {
          type: "socket",
          channel: `ticket_${ticket.id}`,
          event: "update",
          obj: ticket,
        },
        req.company[0].callback
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
      const companyVerified = await companyModel.getByIdActive(
        data.authorization
      );

      if (!companyVerified || companyVerified.length <= 0) return false;

      let ticket = await ticketModel.getTicketById(data.id, data.authorization);

      if (!ticket || ticket.length <= 0) return false;

      let obj = {
        // ids_crm: data.ids_crm,
        // id_customer: data.id_customer,
        // id_protocol: data.id_protocol,
        updated_at: moment().format(),
      };

      // let result = await ticketModel.updateTicket(
      //   obj,
      //   data.id,
      //   data.authorization
      // );
      ticket = await formatTicketForPhase(ticket, ticket[0]);

      // await this._createResponsibles(userResponsible, data.id);

      let phase = await phaseModel.getPhase(data.id_phase, data.authorization);

      if (!phase || phase.length <= 0) return false;

      await updateSLA(ticket.id, ticket.phase_id);
      console.log("if de troca de fases -----> ",ticket.phase_id != phase[0].id)
      if (ticket.phase_id != phase[0].id) {
       console.log( "disable phase ticket= =====>",await phaseModel.disablePhaseTicket(data.id))
        console.log("disable sla ------>",await slaModel.disableSLA(data.id))

        if (data.form) {
          if (Object.keys(data.form).length > 0) {
            if (phase[0].form) {
              let errors = await this._validateForm(
                global.mongodb,
                phase[0].id_form_template,
                data.form
              );
              if (errors.length > 0)
                return res.status(400).send({ errors: errors });

              obj.id_form = await new FormDocuments(
                global.mongodb
              ).createRegister(data.form);
            }
          }
        }
        const user = await userController.checkUserCreated(
          data.id_user,
          data.authorization,
          data.name ? data.name : "",
          data.phone ? data.phone : "",
          data.email ? data.email : "",
          data.type_user ? data.type_user : 1
        );
        let phase_id = await ticketModel.createPhaseTicket({
          id_phase: phase[0].id,
          id_ticket: data.id,
          id_user: user.id,
          id_form: obj.id_form,
        });
        console.log('phase_id',phase_id)
        if (!phase_id || phase_id.length <= 0) return false;

        await createSLAControl(phase[0].id, data.id);

        await CallbackDigitalk(
          {
            type: "socket",
            channel: `phase_${ticket.phase_id}`,
            event: "move_ticket_old_phase",
            obj: { id: ticket.id, id_phase: ticket.phase_id },
          },
          companyVerified[0].callback
        );

        await CallbackDigitalk(
          {
            type: "socket",
            channel: `phase_${phase[0].id}`,
            event: "move_ticket_new_phase",
            obj: { ...ticket, phase_id: phase[0].id },
          },
          companyVerified[0].callback
        );

        await CallbackDigitalk(
          {
            type: "socket",
            channel: `ticket_${ticket.id}`,
            event: "activity",
            obj: {
              type: "move",
              id_user: data.id_user,
              phase_dest: {
                id: phase[0].id,
                name: phase[0].name,
              },
              phase_origin: {
                id: ticket.phase_id,
                name: ticket.phase,
              },
              created_at: moment().format("DD/MM/YYYY HH:mm:ss"),
            },
          },
          companyVerified[0].callback
        );
      } else {
        if (data.form && Object.keys(data.form).length > 0) {
          const firstPhase = await ticketModel.getFirstFormTicket(ticket[0].id);
          if (firstPhase[0].form) {
            let errors = await this._validateUpdate(
              global.mongodb,
              firstPhase[0].id_form_template,
              data.form,
              firstPhase[0].id_form
            );
            if (errors.length > 0) return false;

            await new FormDocuments(global.mongodb).updateRegister(
              firstPhase[0].id_form,
              data.form
            );
          }
        }
      }

      const dashPhase = await phaseModel.getPhaseById(
        ticket.phase_id,
        data.authorization
      );

      await cache(
        data.authorization,
        dashPhase[0].id_department,
        ticket.phase_id
      );

      await this._notify(
        ticket.id,
        phase[0].id,
        data.authorization,
        "progress",
        companyVerified[0].callback
      );
      if (!ticket.start_ticket) {
        await this._notify(
          ticket.id,
          phase[0].id,
          data.authorization,
          "start_activity",
          companyVerified[0].callback
        );

        obj.start_ticket = moment();
        obj.id_status = 2;
      }
      delete obj.id_form;
      let result = await ticketModel.updateTicket(
        obj,
        data.id,
        data.authorization
      );

      await redis.set(`msTicket:ticket:${data.id}`, JSON.stringify(ticket));

      await CallbackDigitalk(
        {
          type: "socket",
          channel: `phase_${data.id_phase}`,
          event: "update_ticket",
          obj: ticket,
        },
        companyVerified[0].callback
      );

      await CallbackDigitalk(
        {
          type: "socket",
          channel: `ticket_${ticket.id}`,
          event: "update",
          obj: ticket,
        },
        companyVerified[0].callback
      );

      await redis.del(`ticket:phase:${data.authorization}`);
      if (result) return true;

      return false;
    } catch (err) {
      console.log("Error when generate object to save ticket => ", err);
      return false;
    }
  }

  async closedTicket(req, res) {
    try {
      const user = await userController.checkUserCreated(
        req.body.id_user,
        req.headers.authorization,
        req.body.name ? req.body.name : "",
        req.body.phone ? req.body.phone : "",
        req.body.email ? req.body.email : "",
        req.body.type_user ? req.body.type_user : 1
      );
      const result = await ticketModel.closedTicket(req.params.id, user.id);

      if (result && result[0].id) {
        await redis.del(`msTicket:ticket:${result[0].id}`);

        let ticket = await ticketModel.getTicketById(
          req.params.id,
          req.headers.authorization
        );

        let slaTicket = await slaModel.getByPhaseTicket(
          ticket[0].phase_id,
          ticket[0].id,
          3
        );
        let obj;
        if (slaTicket && Array.isArray(slaTicket) && slaTicket.length > 0) {
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
          await slaModel.updateTicketSLA(
            ticket[0].id,
            obj,
            slaTicket.id_sla_type,
            ticket[0].phase_id
          );
        }

        // Uma nova verificação para saber se o sla de resposta se manteve no tempo determinado.
        slaTicket = await slaModel.getByPhaseTicket(
          ticket[0].phase_id,
          ticket[0].id,
          2
        );

        if (
          slaTicket &&
          Array.isArray(slaTicket) &&
          slaTicket.length > 0 &&
          !slaTicket[0].interaction_time
        ) {
          if (slaTicket[0].limit_sla_time < moment()) {
            obj = {
              id_sla_status: sla_status.atrasado,
              active: false,
            };
          } else if (slaTicket[0].limit_sla_time > moment()) {
            obj = {
              id_sla_status: sla_status.emdia,
              active: false,
            };
          }
          await slaModel.updateTicketSLA(
            ticket[0].id,
            obj,
            slaTicket.id_sla_type,
            ticket[0].phase_id
          );
        }

        await slaModel.disableSLA(ticket[0].id);
        ticket[0] = await formatTicketForPhase(
          { id: ticket[0].phase_id },
          ticket[0]
        );

        await this._notify(
          ticket[0].id,
          ticket[0].phase_id,
          req.headers.authorization,
          "close",
          req.company[0].callback
        );

        await CallbackDigitalk(
          {
            type: "socket",
            channel: `phase_${ticket[0].phase_id}`,
            event: "update_ticket",
            obj: ticket[0],
          },
          req.company[0].callback
        );
        await CallbackDigitalk(
          {
            type: "socket",
            channel: `ticket_${ticket[0].id}`,
            event: "update",
            obj: ticket[0],
          },
          req.company[0].callback
        );

        const phase = await phaseModel.getPhaseById(
          ticket[0].phase_id,
          req.headers.authorization
        );

        await cache(
          req.headers.authorization,
          phase[0].id_department,
          ticket[0].phase_id
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

  async cronCheckSLA(req, res) {
    const tickets = await slaModel.checkSLA(req.params.type);
    if (tickets && Array.isArray(tickets) && tickets.length > 0) {
      switch (req.params.type) {
        case 1:
          for (const ticket of tickets) {
            if (!ticket.interaction_time && ticket.limit_sla_time < moment()) {
              slaModel.updateTicketSLA(
                ticket.id_ticket,
                { id_sla_status: sla_status.atrasado },
                ticket.id_sla_type
              );
            }
          }
          break;
        case 2:
          for (const ticket of tickets) {
            if (
              ticket.interaction_time < ticket.limit_sla_time &&
              ticket.limit_sla_time < moment()
            ) {
              slaModel.updateTicketSLA(
                ticket.id_ticket,
                { id_sla_status: sla_status.atrasado },
                ticket.id_sla_type
              );
            }
          }
          break;
        case 3:
          for (const ticket of tickets) {
            if (ticket.limit_sla_time < moment()) {
              slaModel.updateTicketSLA(
                ticket.id_ticket,
                { id_sla_status: sla_status.atrasado },
                ticket.id_sla_type
              );
            }
          }
          break;
        default:
          break;
      }
    }
    res.status(200).send(true);
  }

  async checkSLA(type) {
    const tickets = await slaModel.checkSLA(type);
    if (tickets && Array.isArray(tickets) && tickets.length > 0) {
      switch (type) {
        case 1:
          for (const ticket of tickets) {
            if (!ticket.interaction_time && ticket.limit_sla_time < moment()) {
              console.log("1");
              await slaModel.updateTicketSLA(
                ticket.id_ticket,
                { id_sla_status: sla_status.atrasado },
                ticket.id_sla_type,
                ticket.id_phase
              );
            }
          }
          break;
        case 2:
          for (const ticket of tickets) {
            if (
              ticket.interaction_time < ticket.limit_sla_time &&
              ticket.limit_sla_time < moment()
            ) {
              await slaModel.updateTicketSLA(
                ticket.id_ticket,
                { id_sla_status: sla_status.atrasado },
                ticket.id_sla_type,
                ticket.id_phase
              );
            }
          }
          break;
        case 3:
          for (const ticket of tickets) {
            if (ticket.limit_sla_time < moment()) {
              await slaModel.updateTicketSLA(
                ticket.id_ticket,
                { id_sla_status: sla_status.atrasado },
                ticket.id_sla_type,
                ticket.id_phase
              );
            }
          }
          break;
        default:
          break;
      }
    }
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
      for (let column of form_template.column) {
        column.required && !form[column.column]
          ? errors.push(`O campo ${column.column} é obrigatório`)
          : "";
      }

      const formColumns = Object.keys(form);
      for (const column of formColumns) {
        form_template.column.filter((x) => x.column === column).length > 0
          ? ""
          : errors.push(`O campo ${column} não faz parte desse template`);
      }
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
      for (let ticket of result) {
        ticket = await formatTicketForPhase([ticket], ticket);

        const sla_status = function (sla) {
          if (sla) {
            let status = "";
            const keys = Object.keys(sla);
            for (const key of keys) {
              if (sla[key].status === "Em dia") {
                return "Em dia";
              } else {
                status = sla[key].status;
              }
            }
            return status;
          } else {
            return "";
          }
        };
        ticket.sla_status = sla_status(ticket.sla);
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

  async startTicket(req, res) {
    try {
      if (req.body.id_ticket && req.body.id_user) {
        const result = await userController.checkUserCreated(
          req.body.id_user,
          req.headers.authorization,
          req.body.name ? req.body.name : "",
          req.body.phone ? req.body.phone : "",
          req.body.email ? req.body.email : "",
          req.body.type_user ? req.body.type_user : 1
        );
        const time = moment();
        const responsibleCheck =
          await ticketModel.getResponsibleByTicketAndUser(
            req.body.id_ticket,
            result.id
          );

        const ticket = await ticketModel.getTicketById(
          req.body.id_ticket,
          req.headers.authorization
        );
        console.log("req.body =>", req.body);
        if (ticket && ticket.length > 0 && !ticket[0].start_ticket) {
          ticket[0].start_ticket = time;
          await ticketModel.updateTicket(
            { start_ticket: time, id_status: 2 },
            req.body.id_ticket,
            req.headers.authorization
          );

          await updateSLA(req.body.id_ticket, ticket[0].phase_id);
        }

        const phase = await phaseModel.getPhaseById(
          ticket[0].phase_id,
          req.headers.authorization
        );
        await cache(
          req.headers.authorization,
          phase[0].id_department,
          ticket[0].phase_id
        );

        await this._notify(
          ticket[0].id,
          ticket[0].id_phase,
          req.headers.authorization,
          "start_activity",
          req.company[0].callback
        );
        await CallbackDigitalk(
          {
            type: "socket",
            channel: `phase_${ticket[0].id_phase}`,
            event: "update_ticket",
            obj: ticket[0],
          },
          req.company[0].callback
        );
        await CallbackDigitalk(
          {
            type: "socket",
            channel: `ticket_${ticket[0].id}`,
            event: "update",
            obj: ticket[0],
          },
          req.company[0].callback
        );
        if (
          responsibleCheck &&
          Array.isArray(responsibleCheck) &&
          responsibleCheck.length > 0 &&
          !responsibleCheck[0].start_ticket
        ) {
          await ticketModel.updateResponsible(req.body.id_ticket, result.id, {
            start_ticket: time,
          });
          return res
            .status(200)
            .send({ start_ticket: moment(time).format("DD/MM/YYYY HH:mm:ss") });
        } else if (
          responsibleCheck &&
          Array.isArray(responsibleCheck) &&
          responsibleCheck.length <= 0
        ) {
          await ticketModel.createResponsibleTicket({
            id_ticket: req.body.id_ticket,
            id_user: result.id,
            id_type_of_responsible: 2,
            start_ticket: time,
          });
          return res
            .status(200)
            .send({ start_ticket: moment(time).format("DD/MM/YYYY HH:mm:ss") });
        } else if (
          responsibleCheck &&
          Array.isArray(responsibleCheck) &&
          responsibleCheck.length > 0 &&
          responsibleCheck[0].start_ticket
        ) {
          return res.status(400).send({
            error: "Não é possivel iniciar um ticket já inicializado",
          });
        }
      } else {
        return res.status(400).send({ error: "Houve um erro! " });
      }
    } catch (err) {
      console.log("err", err);
      return res.status(500).send({ error: "Houve um erro! " });
    }
  }

  async linkProtocolToTicket(req, res) {
    try {
      if (!req.body.id_ticket || !req.body.id_protocol || req.body.id_user)
        return res.status(400).send({ error: "Houve algum problema" });

      const ticket = await ticketModel.getTicketByIdSeq(
        req.body.id_ticket,
        req.headers.authorization
      );

      if (!ticket || ticket.length < 0)
        return res.status(400).send({ error: "Houve algum problema" });

      const user = await userController.checkUserCreated(
        req.body.id_user,
        req.headers.authorization,
        req.body.name ? req.body.name : "",
        req.body.phone ? req.body.phone : "",
        req.body.email ? req.body.email : "",
        req.body.type_user ? req.body.type_user : 1
      );

      if (!user) return res.status(400).send({ error: "Houve algum problema" });

      const obj = {
        id_ticket: ticket[0].id,
        id_protocol: req.body.id_protocol,
        id_company: req.headers.authorization,
        created_at: moment().format(),
        updated_at: moment().format(),
        id_user: user.id,
        created_by_ticket: req.body.created_by_ticket,
      };

      const result = await ticketModel.linkProtocolToticket(obj);

      if (result.length <= 0)
        return res.status(400).send({ error: "Houve algum problema" });

      obj.created_at = moment(obj.created_at).format("DD/MM/YYYY HH:mm:ss");
      obj.updated_at = moment(obj.updated_at).format("DD/MM/YYYY HH:mm:ss");
      return res.status(200).send(obj);
    } catch (err) {
      console.log("linkProtocolToTicket ====>", err);
      return res.status(400).send({ error: "Houve algum problema" });
    }
  }

  async viewTicket(req, res) {
    try {
      if (!req.body.id_ticket || !req.body.id_user || !req.body.type)
        return res.status(400).send({ error: "Houve algum problema" });

      const user = await userController.checkUserCreated(
        req.body.id_user,
        req.headers.authorization,
        req.body.name ? req.body.name : "",
        req.body.phone ? req.body.phone : "",
        req.body.email ? req.body.email : "",
        req.body.type_user ? req.body.type_user : 1
      );

      if (!user) return res.status(400).send({ error: "Houve algum problema" });

      const ticket = await ticketModel.getTicketById(
        req.body.id_ticket,
        req.headers.authorization
      );

      if (!ticket || ticket.length < 0)
        return res.status(400).send({ error: "Houve algum problema" });

      const obj = {
        id_ticket: ticket[0].id,
        start: null,
        end: null,
        id_user: user.id,
      };
      switch (req.body.type) {
        case "start":
          obj.start = moment().format();
          break;
        case "end":
          obj.end = moment().format();
          break;
        default:
          console.log("tipo não mapeado");
          break;
      }

      const result = await ticketModel.insertViewTicket(obj);
      if (!result)
        return res.status(400).send({ error: "Houve algum problema" });

      return res.status(200).send(obj);
    } catch (err) {
      console.log("Error view ticket =>", err);
      return res.status(400).send({ error: "Houve algum problema" });
    }
  }

  async history_ticket(req, res) {
    try {
      const ticket = await ticketModel.getTicketById(
        req.params.id,
        req.headers.authorization
      );

      if (!ticket || !Array.isArray(ticket))
        return res.status(400).send({ error: "Houve algum problema" });

      const history = [];

      const slaInfo = await formatTicketForPhase(
        { id: ticket[0].phase_id },
        ticket[0]
      );

      const sla_status = function (sla) {
        if (sla) {
          let status = "";
          const keys = Object.keys(sla);
          for (const key of keys) {
            if (sla[key].status === "Aberto") {
              return "Aberto";
            } else {
              status = sla[key].status;
            }
          }
          return status;
        } else {
          return "";
        }
      };

      history.push({
        id_seq: ticket[0].id_seq,
        id_user: ticket[0].id_user,
        user: ticket[0].name,
        created_at: ticket[0].created_at,
        closed: ticket[0].closed,
        department_origin: ticket[0].department_origin,
        phase_name: ticket[0].phase,
        display_name: ticket[0].display_name,
        id_protocol: ticket[0].id_protocol,
        type: "ticket",
        sla_status: sla_status(slaInfo.sla),
        customer: await customerModel.getAll(ticket[0].id),
      });

      const child_tickets = await ticketModel.getTicketCreatedByTicketFather(
        req.params.id,
        req.headers.authorization
      );
      if (child_tickets && child_tickets.length > 0) {
        for (const child_ticket of child_tickets) {
          child_ticket.created_at = moment(child_ticket.created_at).format(
            "DD/MM/YYYY HH:mm:ss"
          );
          child_ticket.type = "ticket";
          ticket[0].history.push(child_ticket);
        }
      }

      const father_ticket = await ticketModel.getTicketById(
        ticket[0].id_ticket_father,
        req.headers.authorization
      );
      if (father_ticket && father_ticket.length > 0) {
        history.push({
          id_seq: father_ticket[0].id_seq,
          id_user: father_ticket[0].id_user,
          user: father_ticket[0].name,
          created_at: moment(father_ticket[0].created_at).format(
            "DD/MM/YYYY HH:mm:ss"
          ),
          closed: father_ticket[0].closed,
          department_origin: father_ticket[0].department_origin,
          phase_name: father_ticket[0].phase,
          display_name: father_ticket[0].display_name,
          id_protocol: father_ticket[0].id_protocol,
          type: "ticket",
          customer: await customerModel.getAll(father_ticket[0].id),
        });
      }

      const customers = await customerModel.getAll(req.params.id);
      if (customers && customers.length > 0) {
        for (const customer of customers) {
          const customersRelated =
            await customerModel.getByIdentification_document(
              customer.identification_document
            );
          if (customersRelated && customersRelated.length > 0) {
            for (const customerRelated of customersRelated) {
              const ticketRelated = await ticketModel.getTicketById(
                customerRelated.id_ticket,
                req.headers.authorization
              );
              if (ticketRelated && ticketRelated.length > 0) {
                ticket[0].history.push({
                  id_seq: ticketRelated[0].id_seq,
                  id_user: ticketRelated[0].id_user,
                  user: ticketRelated[0].name,
                  created_at: moment(ticketRelated[0].created_at).format(
                    "DD/MM/YYYY HH:mm:ss"
                  ),
                  closed: ticketRelated[0].closed,
                  department_origin: ticketRelated[0].department_origin,
                  phase_name: ticketRelated[0].phase,
                  display_name: ticketRelated[0].display_name,
                  id_protocol: ticketRelated[0].id_protocol,
                  type: "ticket",
                  customer: await customerModel.getAll(ticketRelated[0].id),
                });
              }
            }
          }
        }
      }

      const protocols = await ticketModel.getProtocolTicket(
        req.params.id,
        req.headers.authorization
      );
      if (protocols && protocols.length > 0) {
        for (const protocol of protocols) {
          history.push({
            id: protocol.id_protocol,
            type: "protocol",
          });
        }
      }

      if (ticket[0].id_protocol) {
        history.push({
          id: ticket[0].id_protocol,
          type: "protocol",
        });
      }

      return res.status(200).send(history);
    } catch (err) {
      console.log("Error history_ticket =>", err);
      return res.status(500).send({ error: "Houve algum problema" });
    }
  }

  async tab(req, res) {
    try {
      const ticket = await ticketModel.getTicketById(req.body.id_ticket);
      if (ticket.length <= 0)
        return res.status(500).send({ error: "Não existe ticket com esse ID" });

      await ticketModel.updateTicket(
        { id_tab: req.body.id_tab, updated_at: moment().format() },
        req.body.id_ticket,
        req.headers.authorization
      );

      return res.status(200).send(req.body)
    } catch (err) {
      console.log("tab err ====> ", err);
      return res
        .status(500)
        .send({ error: "Ocorreu um erro ao tabular o ticket" });
    }
  }
}

module.exports = TicketController;
