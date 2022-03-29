import { v1 } from "uuid";
import moment from "moment";
import asyncRedis from "async-redis";
const redis = asyncRedis.createClient(
  process.env.REDIS_PORT,
  process.env.REDIS_HOST
);
import cache from "../helpers/Cache.js";
import SLAModel from "../models/SLAModel.js";
import UserModel from "../models/UserModel.js";
import SLAController from "./SLAController.js";
import UserController from "./UserController.js";
import PhaseModel from "../models/PhaseModel.js";
import TicketModel from "../models/TicketModel.js";
import CompanyModel from "../models/CompanyModel.js";
import { validationResult } from "express-validator";
import CustomerModel from "../models/CustomerModel.js";
import FormTemplate from "../documents/FormTemplate.js";
import FormDocuments from "../documents/FormDocuments.js";
import ActivitiesModel from "../models/ActivitiesModel.js";
import TypeColumnModel from "../models/TypeColumnModel.js";
import DepartmentController from "./DepartmentController.js";
import AttachmentsModel from "../models/AttachmentsModel.js";
import CallbackDigitalk from "../services/CallbackDigitalk.js";
import { formatTicketForPhase } from "../helpers/FormatTicket.js";

const sla_status = {
  emdia: 1,
  atrasado: 2,
  aberto: 3,
};

export default class TicketController {
  constructor(database = {}, logger = {}) {
    this.logger = logger;
    this.database = database;
    this.slaModel = new SLAModel(database, logger);
    this.userModel = new UserModel(database, logger);
    this.phaseModel = new PhaseModel(database, logger);
    this.ticketModel = new TicketModel(database, logger);
    this.companyModel = new CompanyModel(database, logger);
    this.slaController = new SLAController(database, logger);
    this.customerModel = new CustomerModel(database, logger);
    this.userController = new UserController(database, logger);
    this.typeColumnModel = new TypeColumnModel(database, logger);
    this.activitiesModel = new ActivitiesModel(database, logger);
    this.attachmentsModel = new AttachmentsModel(database, logger);
    this.departmentController = new DepartmentController(database, logger);
    this.formTemplate = new FormTemplate(logger);
  }
  //Remover assim que função da fila funcionar direitinho
  async create(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    try {
      let id_user = await this.userController.checkUserCreated(
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
        let department = await this.departmentController.checkDepartmentCreated(
          req.body.department_origin,
          req.headers.authorization
        );
        obj.department_origin = department[0].id;
      }

      let phase = await this.phaseModel.getPhase(
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
        const ticketFather = await this.ticketModel.getTicketById(
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

      let result = await this.ticketModel.create(obj);

      if (!req.body.display_name || req.body.display_name === "") {
        await this.ticketModel.updateTicket(
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

      let phase_id = await this.ticketModel.createPhaseTicket({
        id_phase: phase[0].id,
        id_ticket: obj.id,
        id_user: id_user.id,
        id_form: obj.id_form,
      });

      if (!phase_id || phase_id.length <= 0)
        return res.status(500).send({ error: "There was an error" });

      let ticket = await this.ticketModel.getTicketById(
        obj.id,
        req.headers.authorization
      );
      await redis.set(
        `msTicket:ticket:${ticket.id}`,
        JSON.stringify(ticket[0])
      );

      if (result && result.length > 0 && result[0].id) {
        await this.slaController.createSLAControl(phase[0].id, obj.id);

        ticket = await formatTicketForPhase(
          { id: phase[0].id },
          ticket[0],
          this.database,
          this.logger
        );

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

      const companyVerified = await this.companyModel.getByIdActive(
        data.authorization
      );

      if (!companyVerified || companyVerified.length <= 0) return false;

      let id_user = await this.userController.checkUserCreated(
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
        let department = await this.departmentController.checkDepartmentCreated(
          data.department_origin,
          data.authorization
        );
        obj.department_origin = department[0].id;
      }

      let phase = await this.phaseModel.getPhase(
        data.id_phase,
        data.authorization
      );
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
        const ticketFather = await this.ticketModel.getTicketById(
          data.id_ticket_father,
          data.authorization
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

      let result = await this.ticketModel.create(obj);

      if (!data.display_name || data.display_name === "") {
        await this.ticketModel.updateTicket(
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

      let phase_id = await this.ticketModel.createPhaseTicket({
        id_phase: phase[0].id,
        id_ticket: obj.id,
        id_user: id_user.id,
        id_form: obj.id_form,
      });

      if (!phase_id || phase_id.length <= 0) return false;

      let ticket = await this.ticketModel.getTicketById(
        obj.id,
        data.authorization
      );
      await redis.set(
        `msTicket:ticket:${ticket.id}`,
        JSON.stringify(ticket[0])
      );

      if (result && result.length > 0 && result[0].id) {
        ticket = await formatTicketForPhase(
          { id: phase[0].id },
          ticket[0],
          this.database,
          this.logger
        );

        const dashPhase = await this.phaseModel.getPhaseById(
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
      await this.ticketModel.delResponsibleTicket(ticket_id);
      if (userResponsible.length > 0) {
        userResponsible.map(async (user) => {
          await this.ticketModel.createResponsibleTicket({
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
      // await this.customerModel.delCustomerTicket(ticket_id);
      // if (customer.length > 0) {
      //   for (let c of customer) {
      await this.customerModel.create({
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
    console.log("params ====>",id_phase, id_company)
    const phase = await this.phaseModel.getPhaseById(id_phase, id_company);
    const ticket = await this.ticketModel.getTicketById(id_ticket, id_company);

    console.log("======>",phase)
    let obj = {
      type: "notification",
      id_ticket: ticket[0].id_seq,
      id_protocol: ticket[0].id_protocol,
      customer: await this.customerModel.getAll(ticket[0].id),
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
          if (phase[0].customer.channels)
            obj.channels = phase[0].customer.channels;

          await CallbackDigitalk(obj, callback);
        }

        if (phase[0].admin && phase[0].admin.notify_open) {
          if (phase[0].admin && phase[0].admin.notify_open) {
            obj = { ...obj, notified: "admin" };
            if (phase[0].admin.notify_open_message)
              obj.message = phase[0].admin.notify_open_message;
            if (phase[0].admin.notify_open_hsm)
              obj.hsm_id = phase[0].admin.notify_open_hsm;
            if (phase[0].admin.channels) obj.channels = phase[0].admin.channels;

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
              if (separate.notify_open_message)
                obj.message = separate.notify_open_message;
              if (separate.notify_open_hsm)
                obj.hsm_id = separate.notify_open_hsm;
              if (separate.channels) obj.channels = separate.channels;

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
          if (phase[0].customer.channels)
            obj.channels = phase[0].customer.channels;

          await CallbackDigitalk(obj, callback);
        }

        if (phase[0].admin && phase[0].admin.notify_progress) {
          if (phase[0].admin && phase[0].admin.notify_open) {
            obj = { ...obj, notified: "admin" };
            if (phase[0].admin.notify_progress_message)
              obj.message = phase[0].admin.notify_progress_message;
            if (phase[0].admin.notify_progress_hsm)
              obj.hsm_id = phase[0].admin.notify_progress_hsm;
            if (phase[0].admin.channels) obj.channels = phase[0].admin.channels;

            await CallbackDigitalk(obj, callback);
          }
        }

        if (phase[0].separate && phase[0].separate.separate.length > 0) {
          for (const separate of phase[0].separate.separate) {
            if (
              separate.notify_open &&
              separate.contact &&
              separate.contact.length > 0
            ) {
              const email = separate.contact.filter((x) => x.email);
              const phone = separate.contact.filter((x) => x.phone);

              obj = {
                ...obj,
                notified: "separate",
                email: email.length > 0 ? email[0].email : "",
                phone: phone.length > 0 ? phone[0].phone : "",
              };
              if (separate.notify_progress_message)
                obj.message = separate.notify_progress_message;
              if (separate.notify_progress_hsm)
                obj.hsm_id = separate.notify_progress_hsm;
              if (separate.channels) obj.channels = separate.channels;

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
          if (phase[0].customer.channels)
            obj.channels = phase[0].customer.channels;

          await CallbackDigitalk(obj, callback);
        }

        if (phase[0].admin && phase[0].admin.notify_close) {
          if (phase[0].admin && phase[0].admin.notify_open) {
            obj = { ...obj, notified: "admin" };
            if (phase[0].admin.notify_close_message)
              obj.message = phase[0].admin.notify_close_message;
            if (phase[0].admin.notify_close_hsm)
              obj.hsm_id = phase[0].admin.notify_close_hsm;
            if (phase[0].admin.channels) obj.channels = phase[0].admin.channels;
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

              if (separate.notify_close_message)
                obj.message = separate.notify_close_message;
              if (separate.notify_close_hsm)
                obj.hsm_id = separate.notify_close_hsm;
                if (separate.channels) obj.channels = separate.channels;


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
            if (phase[0].customer.channels) obj.channels = phase[0].customer.channels;
          await CallbackDigitalk(obj, callback);
        }

        if (phase[0].admin && phase[0].admin.notify_start_activity) {
          if (phase[0].admin && phase[0].admin.notify_open) {
            obj = { ...obj, notified: "admin" };
            if (phase[0].admin.notify_start_activity_message)
              obj.message = phase[0].admin.notify_start_activity_message;
            if (phase[0].admin.notify_start_activity_hsm)
              obj.hsm_id = phase[0].admin.notify_start_activity_hsm;
              if (phase[0].admin.channels) obj.channels = phase[0].admin.channels;
            await CallbackDigitalk(obj, callback);
          }
        }

        if (phase[0].separate && phase[0].separate.separate.length > 0) {
          for (const separate of phase[0].separate.separate) {
            if (
              separate.contact &&
              separate.contact.length > 0 &&
              separate.notify_start_activity
            ) {
              const email = separate.contact.filter((x) => x.email);
              const phone = separate.contact.filter((x) => x.phone);

              obj = {
                ...obj,
                notified: "separate",
                email: email.length > 0 ? email[0].email : "",
                phone: phone.length > 0 ? phone[0].phone : "",
              };
              if (separate.notify_start_activity_message)
                obj.message = separate.notify_start_activity_message;
              if (separate.notify_start_activity_hsm)
                obj.hsm_id = separate.notify_start_activity_hsm;
                if (separate.channels) obj.channels = phase[0].admin.channels;

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
            if (phase[0].customer.channels) obj.channels = phase[0].customer.channels;
          await CallbackDigitalk(obj, callback);
        }

        if (phase[0].admin && phase[0].admin.notify_first_reply) {
          if (phase[0].admin && phase[0].admin.notify_open) {
            obj = { ...obj, notified: "admin" };
            if (phase[0].admin.notify_start_activity_message)
              obj.message = phase[0].admin.notify_start_activity_message;
            if (phase[0].admin.notify_start_activity_hsm)
              obj.hsm_id = phase[0].admin.notify_start_activity_hsm;
              if (phase[0].admin.channels) obj.channels = phase[0].admin.channels;
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

              if (separate.notify_start_activity_message)
                obj.message = separate.notify_start_activity_message;
              if (separate.notify_start_activity_hsm)
                obj.hsm_id = separate.notify_start_activity_hsm;
                if (separate.channels) obj.channels = separate.channels;
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

      let user = await this.userController.checkUserCreated(
        req.body.id_user,
        req.headers.authorization,
        req.body.name ? req.body.name : "",
        req.body.phone ? req.body.phone : "",
        req.body.email ? req.body.email : "",
        req.body.type_user ? req.body.type_user : 1
      );

      if (!user || !user.id)
        return res.status(400).send({ error: "There was an error" });

      let ticket = await this.ticketModel.getTicketById(
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

        await this.ticketModel.updateTicket(
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

      let result = await this.activitiesModel.create(obj);

      if (result && result.length > 0) {
        await this.slaController.updateSLA(
          req.body.id_ticket,
          ticket[0].phase_id,
          true
        );

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
      const companyVerified = await this.companyModel.getByIdActive(
        data.authorization
      );

      if (!companyVerified || companyVerified.length <= 0) return false;

      if (!data.id_user) return false;

      let user = await this.userController.checkUserCreated(
        data.id_user,
        data.authorization,
        data.name ? data.name : "",
        data.phone ? data.phone : "",
        data.email ? data.email : "",
        data.type_user ? data.type_user : 1
      );

      if (!user || !user.id) return false;

      let ticket = await this.ticketModel.getTicketById(
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

        await this.ticketModel.updateTicket(
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

      let result = await this.activitiesModel.create(obj);
      console.log("teste");
      if (result && result.length > 0) {
        await this.slaController.updateSLA(
          data.id_ticket,
          ticket[0].phase_id,
          true
        );

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

        const dashPhase = await this.phaseModel.getPhaseById(
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

      let user = await this.userController.checkUserCreated(
        req.body.id_user,
        req.headers.authorization,
        req.body.name ? req.body.name : "",
        req.body.phone ? req.body.phone : "",
        req.body.email ? req.body.email : "",
        req.body.type_user ? req.body.type_user : 1
      );

      if (!user || !user.id)
        return res.status(400).send({ error: "There was an error" });

      let ticket = await this.ticketModel.getTicketById(
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

        await this.ticketModel.updateTicket(
          { start_ticket: moment(), id_status: 2 },
          req.body.id_ticket,
          req.headers.authorization
        );
      }

      let typeAttachments = await this.ticketModel.getTypeAttachments(
        req.body.type
      );

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

      let result = await this.attachmentsModel.create(obj);

      await this.slaController.updateSLA(
        req.body.id_ticket,
        ticket[0].phase_id,
        true
      );

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
      const companyVerified = await this.companyModel.getByIdActive(
        data.authorization
      );

      if (!companyVerified || companyVerified.length <= 0) return false;

      if (!data.id_user) return false;

      let user = await this.userController.checkUserCreated(
        data.id_user,
        data.authorization,
        data.name ? data.name : "",
        data.phone ? data.phone : "",
        data.email ? data.email : "",
        data.type_user ? data.type_user : 1
      );

      if (!user || !user.id) return false;

      let ticket = await this.ticketModel.getTicketById(
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

        await this.ticketModel.updateTicket(
          { start_ticket: moment(), id_status: 2 },
          data.id_ticket,
          data.authorization
        );
      }

      let typeAttachments = await this.ticketModel.getTypeAttachments(
        data.type
      );

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

      let result = await this.attachmentsModel.create(obj);

      await this.slaController.updateSLA(
        data.id_ticket,
        ticket[0].phase_id,
        true
      );

      if (result && result.length > 0) {
        obj.id = result[0].id;

        obj.created_at = moment(obj.created_at).format("DD/MM/YYYY HH:mm:ss");
        obj.updated_at = moment(obj.updated_at).format("DD/MM/YYYY HH:mm:ss");
        obj.type = "file";
        obj.id_user = data.id_user;

        const dashPhase = await this.phaseModel.getPhaseById(
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
      let result = await this.ticketModel.getTicketByIdSeq(
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
        result[0],
        this.database,
        this.logger
      );
      const customer = await this.customerModel.getAll(result.id);
      if (customer && Array.isArray(customer) && customer.length > 0) {
        result.customers = customer;
      }

      const protocols = await this.ticketModel.getProtocolTicket(
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

      const department = await this.phaseModel.getDepartmentPhase(
        result.phase_id
      );
      result.actual_department = department[0].id_department;

      const form = await this.ticketModel.getFormTicket(result.id);

      if (form && form.length > 0 && form[0].id_form) {
        const phase = await this.phaseModel.getPhaseById(
          form[0].id_phase,
          req.headers.authorization
        );
        if (phase[0].form && phase[0].id_form_template) {
          const register = await this.formTemplate.findRegister(
            phase[0].id_form_template
          );

          if (register && register.column) {
            result.form_template = register.column;

            for (const x of result.form_template) {
              console.log("x.type ====>",x.type)
              const type = await this.typeColumnModel.getTypeByName(x.type);

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
      let result = await this.ticketModel.getTicketById(
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
        result[0],
        this.database,
        this.logger
      );
      const customer = await this.customerModel.getAll(result.id);
      if (customer && Array.isArray(customer) && customer.length > 0) {
        result.customers = customer;
      }

      const protocols = await this.ticketModel.getProtocolTicket(
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

      const department = await this.phaseModel.getDepartmentPhase(
        result.phase_id
      );
      result.actual_department = department[0].id_department;

      const form = await this.ticketModel.getFormTicket(result.id);

      if (form && form.length > 0 && form[0].id_form) {
        const phase = await this.phaseModel.getPhaseById(
          form[0].id_phase,
          req.headers.authorization
        );
        if (phase[0].form && phase[0].id_form_template) {
          const register = await this.formTemplate.findRegister(
            phase[0].id_form_template
          );

          if (register && register.column) {
            result.form_template = register.column;

            for (const x of result.form_template) {
              const type = await this.typeColumnModel.getTypeByName(x.type);

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

    const activities = await this.activitiesModel.getActivities(id_ticket);
    activities.map((value) => {
      value.created_at = moment(value.created_at).format("DD/MM/YYYY HH:mm:ss");
      value.updated_at = moment(value.updated_at).format("DD/MM/YYYY HH:mm:ss");
      value.type = "note";
      obj.push(value);
    });

    const attachments = await this.attachmentsModel.getAttachments(id_ticket);
    attachments.map((value) => {
      value.created_at = moment(value.created_at).format("DD/MM/YYYY HH:mm:ss");
      value.updated_at = moment(value.updated_at).format("DD/MM/YYYY HH:mm:ss");
      value.type = "file";
      obj.push(value);
    });

    let history_phase = await this.ticketModel.getHistoryTicket(id_ticket);
    for (let index in history_phase) {
      index = parseInt(index);

      if (history_phase[index + 1]) {
        const before = await new FormDocuments(db).findRegister(
          history_phase[index].id_form
        );

        const templateBefore = await this.formTemplate.findRegister(
          history_phase[index].template
        );
        console.log("templateBefore =>", templateBefore);
        const after = await new FormDocuments(db).findRegister(
          history_phase[index + 1].id_form
        );

        const templateAfter = await this.formTemplate.findRegister(
          history_phase[index + 1].template
        );
        console.log("created at ----->", history_phase[index + 1]);
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
      const slas = await this.slaModel.getSLAControl(
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

    const view_ticket = await this.ticketModel.getViewTicket(id_ticket);
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

    const create_protocol = await this.ticketModel.getProtocolCreatedByTicket(
      id_ticket,
      id_company
    );
    create_protocol.map((value) => {
      value.created_at = moment(value.created_at).format("DD/MM/YYYY HH:mm:ss");
      value.updated_at = moment(value.updated_at).format("DD/MM/YYYY HH:mm:ss");
      value.type = "create_protocol";
      obj.push(value);
    });

    const create_ticket = await this.ticketModel.getTicketCreatedByTicketFather(
      id_ticket,
      id_company
    );
    create_ticket.map((value) => {
      value.created_at = moment(value.created_at).format("DD/MM/YYYY HH:mm:ss");
      value.type = "create_ticket";
      obj.push(value);
    });

    const ticket = await this.ticketModel.getStatusTicketById(
      id_ticket,
      id_company
    );
    if (ticket[0].created_by_ticket) {
      const ticketFather = await this.ticketModel.getTicketById(
        ticket[0].id_ticket_father,
        id_company
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
      const user = await this.userModel.getById(
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

      const result = await this.ticketModel.getAllTickets(
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
          ticket,
          this.database,
          this.logger
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

      let ticket = await this.ticketModel.getTicketById(
        req.params.id,
        req.headers.authorization
      );

      if (!ticket || ticket.length <= 0)
        return res
          .status(400)
          .send({ error: "There is no ticket with this ID " });

      ticket = await formatTicketForPhase(
        { id: ticket[0].phase_id },
        ticket[0],
        this.database,
        this.logger
      );

      if (ticket.id_status === 3)
        return res
          .status(400)
          .send({ error: "Impossivel atualizar um ticket finalizado!" });
      // if (req.body.customer) {
      //   await this._createCustomers(req.body.customer, req.params.id);
      // }

      let phase = await this.phaseModel.getPhase(
        req.body.id_phase,
        req.headers.authorization
      );

      if (!phase || phase.length <= 0)
        return res.status(400).send({ error: "Invalid id_phase uuid" });

      await this.slaController.updateSLA(ticket.id, ticket.phase_id);
      if (ticket.phase_id != phase[0].id) {
        await this.phaseModel.disablePhaseTicket(req.params.id);
        await this.slaModel.disableSLA(req.params.id);

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
        const user = await this.userController.checkUserCreated(
          req.body.id_user,
          req.headers.authorization,
          req.body.name ? req.body.name : "",
          req.body.phone ? req.body.phone : "",
          req.body.email ? req.body.email : "",
          req.body.type_user ? req.body.type_user : 1
        );
        let phase_id = await this.ticketModel.createPhaseTicket({
          id_phase: phase[0].id,
          id_ticket: req.params.id,
          id_user: user.id,
          id_form: obj.id_form,
        });
        if (!phase_id || phase_id.length <= 0)
          return res.status(500).send({ error: "There was an error" });

        await this.slaController.createSLAControl(phase[0].id, req.params.id);

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
          const firstPhase = await this.ticketModel.getFirstFormTicket(
            ticket[0].id
          );
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
      let result = await this.ticketModel.updateTicket(
        obj,
        req.params.id,
        req.headers.authorization
      );

      await redis.set(
        `msTicket:ticket:${req.params.id}`,
        JSON.stringify(ticket)
      );

      if (ticket.phase_id === phase[0].id) {
        await CallbackDigitalk(
          {
            type: "socket",
            channel: `phase_${req.body.id_phase}`,
            event: "update_ticket",
            obj: ticket,
          },
          req.company[0].callback
        );
      }

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
      const companyVerified = await this.companyModel.getByIdActive(
        data.authorization
      );

      if (!companyVerified || companyVerified.length <= 0) return false;

      let ticket = await this.ticketModel.getTicketById(
        data.id,
        data.authorization
      );

      if (!ticket || ticket.length <= 0) return false;

      let obj = {
        // ids_crm: data.ids_crm,
        // id_customer: data.id_customer,
        // id_protocol: data.id_protocol,
        updated_at: moment().format(),
      };

      // let result = await this.ticketModel.updateTicket(
      //   obj,
      //   data.id,
      //   data.authorization
      // );
      ticket = await formatTicketForPhase(
        { id: ticket[0].phase_id },
        ticket[0],
        this.database,
        this.logger
      );

      // await this._createResponsibles(userResponsible, data.id);

      let phase = await this.phaseModel.getPhase(
        data.id_phase,
        data.authorization
      );

      if (!phase || phase.length <= 0) return false;

      await this.slaController.updateSLA(ticket.id, ticket.phase_id);
      console.log(
        "if de troca de fases -----> ",
        ticket.phase_id != phase[0].id
      );
      if (ticket.phase_id != phase[0].id) {
        console.log(
          "disable phase ticket= =====>",
          await this.phaseModel.disablePhaseTicket(data.id)
        );
        console.log(
          "disable sla ------>",
          await this.slaModel.disableSLA(data.id)
        );

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
        const user = await this.userController.checkUserCreated(
          data.id_user,
          data.authorization,
          data.name ? data.name : "",
          data.phone ? data.phone : "",
          data.email ? data.email : "",
          data.type_user ? data.type_user : 1
        );
        let phase_id = await this.ticketModel.createPhaseTicket({
          id_phase: phase[0].id,
          id_ticket: data.id,
          id_user: user.id,
          id_form: obj.id_form,
        });
        console.log("phase_id", phase_id);
        if (!phase_id || phase_id.length <= 0) return false;

        await this.slaController.createSLAControl(phase[0].id, data.id);

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
          const firstPhase = await this.ticketModel.getFirstFormTicket(
            ticket[0].id
          );
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

      const dashPhase = await this.phaseModel.getPhaseById(
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
      let result = await this.ticketModel.updateTicket(
        obj,
        data.id,
        data.authorization
      );

      await redis.set(`msTicket:ticket:${data.id}`, JSON.stringify(ticket));

      if (ticket.phase_id === phase[0].id) {
        await CallbackDigitalk(
          {
            type: "socket",
            channel: `phase_${data.id_phase}`,
            event: "update_ticket",
            obj: ticket,
          },
          companyVerified[0].callback
        );
      }

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
      const user = await this.userController.checkUserCreated(
        req.body.id_user,
        req.headers.authorization,
        req.body.name ? req.body.name : "",
        req.body.phone ? req.body.phone : "",
        req.body.email ? req.body.email : "",
        req.body.type_user ? req.body.type_user : 1
      );
      const result = await this.ticketModel.closedTicket(
        req.params.id,
        user.id
      );

      if (result && result[0].id) {
        await redis.del(`msTicket:ticket:${result[0].id}`);

        let ticket = await this.ticketModel.getTicketById(
          req.params.id,
          req.headers.authorization
        );

        let slaTicket = await this.slaModel.getByPhaseTicket(
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
          await this.slaModel.updateTicketSLA(
            ticket[0].id,
            obj,
            slaTicket.id_sla_type,
            ticket[0].phase_id
          );
        }

        // Uma nova verificação para saber se o sla de resposta se manteve no tempo determinado.
        slaTicket = await this.slaModel.getByPhaseTicket(
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
          await this.slaModel.updateTicketSLA(
            ticket[0].id,
            obj,
            slaTicket.id_sla_type,
            ticket[0].phase_id
          );
        }

        await this.slaModel.disableSLA(ticket[0].id);
        ticket[0] = await formatTicketForPhase(
          { id: ticket[0].phase_id },
          ticket[0],
          this.database,
          this.logger
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

        const phase = await this.phaseModel.getPhaseById(
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
          const tickets = await this.ticketModel.getAllTicketWhitoutCompanyId();
          if (tickets && tickets.length > 0) {
            for (const ticket of tickets) {
              let result = await this.ticketModel.getTicketById(
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
    const tickets = await this.slaModel.checkSLA(req.params.type);
    if (tickets && Array.isArray(tickets) && tickets.length > 0) {
      switch (req.params.type) {
        case 1:
          for (const ticket of tickets) {
            if (!ticket.interaction_time && ticket.limit_sla_time < moment()) {
              await this.slaModel.updateTicketSLA(
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
              await this.slaModel.updateTicketSLA(
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
              await this.slaModel.updateTicketSLA(
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
    const tickets = await this.slaModel.checkSLA(type);
    if (tickets && Array.isArray(tickets) && tickets.length > 0) {
      switch (type) {
        case 1:
          for (const ticket of tickets) {
            if (!ticket.interaction_time && ticket.limit_sla_time < moment()) {
              console.log("1");
              await this.slaModel.updateTicketSLA(
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
              await this.slaModel.updateTicketSLA(
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
              await this.slaModel.updateTicketSLA(
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

  async _validateForm(db, id_form_template, form) {
    try {
      const errors = [];

      console.log(id_form_template);
      const form_template = await this.formTemplate.findRegister(
        id_form_template
      );
      console.log(form_template);
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
      const form_template = await this.formTemplate.findRegister(
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
      let result = await this.ticketModel.getTicketByCustomerOrProtocol(
        req.params.id
      );
      for (let ticket of result) {
        ticket = await formatTicketForPhase(
          { id: ticket.phase_id },
          ticket,
          this.database,
          this.logger
        );

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
        ticket.history_phase = await this.ticketModel.getHistoryTicket(
          ticket.id
        );
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
      let result = await this.ticketModel.getTicketStatusCount(id_company);

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

      let result = await this.ticketModel.getCountResponsibleTicket(
        id_company,
        obj
      );

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
        const result = await this.userController.checkUserCreated(
          req.body.id_user,
          req.headers.authorization,
          req.body.name ? req.body.name : "",
          req.body.phone ? req.body.phone : "",
          req.body.email ? req.body.email : "",
          req.body.type_user ? req.body.type_user : 1
        );
        const time = moment();
        const responsibleCheck =
          await this.ticketModel.getResponsibleByTicketAndUser(
            req.body.id_ticket,
            result.id
          );

        const ticket = await this.ticketModel.getTicketById(
          req.body.id_ticket,
          req.headers.authorization
        );
        console.log("req.body =>", req.body);
        if (ticket && ticket.length > 0 && !ticket[0].start_ticket) {
          ticket[0].start_ticket = time;
          await this.ticketModel.updateTicket(
            { start_ticket: time, id_status: 2 },
            req.body.id_ticket,
            req.headers.authorization
          );

          await this.slaController.updateSLA(
            req.body.id_ticket,
            ticket[0].phase_id
          );
        }

        const phase = await this.phaseModel.getPhaseById(
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
          ticket[0].phase_id,
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
          await this.ticketModel.updateResponsible(
            req.body.id_ticket,
            result.id,
            {
              start_ticket: time,
            }
          );
          return res
            .status(200)
            .send({ start_ticket: moment(time).format("DD/MM/YYYY HH:mm:ss") });
        } else if (
          responsibleCheck &&
          Array.isArray(responsibleCheck) &&
          responsibleCheck.length <= 0
        ) {
          await this.ticketModel.createResponsibleTicket({
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
      if (!req.body.id_ticket || !req.body.id_protocol || !req.body.id_user)
        return res.status(400).send({ error: "Houve algum problema" });

      const ticket = await this.ticketModel.getTicketById(
        req.body.id_ticket,
        req.headers.authorization
      );

      if (!ticket || ticket.length < 0)
        return res.status(400).send({ error: "Houve algum problema" });

      const user = await this.userController.checkUserCreated(
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

      const result = await this.ticketModel.linkProtocolToticket(obj);

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

      const user = await this.userController.checkUserCreated(
        req.body.id_user,
        req.headers.authorization,
        req.body.name ? req.body.name : "",
        req.body.phone ? req.body.phone : "",
        req.body.email ? req.body.email : "",
        req.body.type_user ? req.body.type_user : 1
      );

      if (!user) return res.status(400).send({ error: "Houve algum problema" });

      const ticket = await this.ticketModel.getTicketById(
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

      const result = await this.ticketModel.insertViewTicket(obj);
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
      const ticket = await this.ticketModel.getTicketById(
        req.params.id,
        req.headers.authorization
      );

      if (!ticket || !Array.isArray(ticket))
        return res.status(400).send({ error: "Houve algum problema" });

      const history = [];

      const slaInfo = await formatTicketForPhase(
        { id: ticket[0].phase_id },
        ticket[0],
        this.database,
        this.logger
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
        status:ticket[0].status,
        customer: await this.customerModel.getAll(ticket[0].id),
      });

      // const child_tickets =
      //   await this.ticketModel.getTicketCreatedByTicketFather(
      //     req.params.id,
      //     req.headers.authorization
      //   );
      // if (child_tickets && child_tickets.length > 0) {
      //   for (const child_ticket of child_tickets) {
          
      //     child_ticket.created_at = moment(child_ticket.created_at).format(
      //       "DD/MM/YYYY HH:mm:ss"
      //     );
      //     child_ticket.type = "ticket";
      //     const slaInfo = await formatTicketForPhase(
      //       { id: child_ticket[0].phase_id },
      //       child_ticket[0],
      //       this.database,
      //       this.logger
      //     );
    
      //     history.push(child_ticket);
      //     history.push({
      //       id_seq: ticket[0].id_seq,
      //       id_user: ticket[0].id_user,
      //       user: ticket[0].name,
      //       created_at: ticket[0].created_at,
      //       closed: ticket[0].closed,
      //       department_origin: ticket[0].department_origin,
      //       phase_name: ticket[0].phase,
      //       display_name: ticket[0].display_name,
      //       id_protocol: ticket[0].id_protocol,
      //       type: "ticket",
      //       sla_status: sla_status(slaInfo.sla),
      //       status:ticket[0].status,
      //       customer: await this.customerModel.getAll(ticket[0].id),
      //     });
      //   }
      // }

      const father_ticket = await this.ticketModel.getTicketById(
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
          status:father_ticket[0].status,
          customer: await this.customerModel.getAll(father_ticket[0].id),
        });
      }

      // const customers = await this.customerModel.getAll(req.params.id);
      // if (customers && customers.length > 0) {
      //   for (const customer of customers) {
      //     const customersRelated =
      //       await this.customerModel.getByIdentification_document(
      //         customer.identification_document
      //       );
      //     if (customersRelated && customersRelated.length > 0) {
      //       for (const customerRelated of customersRelated) {
      //         const ticketRelated = await this.ticketModel.getTicketById(
      //           customerRelated.id_ticket,
      //           req.headers.authorization
      //         );
      //         if (ticketRelated && ticketRelated.length > 0) {
      //           history.push({
      //             id_seq: ticketRelated[0].id_seq,
      //             id_user: ticketRelated[0].id_user,
      //             user: ticketRelated[0].name,
      //             created_at: moment(ticketRelated[0].created_at).format(
      //               "DD/MM/YYYY HH:mm:ss"
      //             ),
      //             closed: ticketRelated[0].closed,
      //             department_origin: ticketRelated[0].department_origin,
      //             phase_name: ticketRelated[0].phase,
      //             display_name: ticketRelated[0].display_name,
      //             id_protocol: ticketRelated[0].id_protocol,
      //             type: "ticket",
      //             customer: await this.customerModel.getAll(
      //               ticketRelated[0].id
      //             ),
      //           });
      //         }
      //       }
      //     }
      //   }
      // }

      const protocols = await this.ticketModel.getProtocolTicket(
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
      const ticket = await this.ticketModel.getTicketById(req.body.id_ticket);
      if (ticket.length <= 0)
        return res.status(500).send({ error: "Não existe ticket com esse ID" });

      await this.ticketModel.updateTicket(
        { id_tab: req.body.id_tab, updated_at: moment().format() },
        req.body.id_ticket,
        req.headers.authorization
      );

      return res.status(200).send(req.body);
    } catch (err) {
      console.log("tab err ====> ", err);
      return res
        .status(500)
        .send({ error: "Ocorreu um erro ao tabular o ticket" });
    }
  }
}
