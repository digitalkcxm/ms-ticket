const { v1 } = require("uuid");
const CompanyModel = require("../models/CompanyModel");
const CustomerModel = require("../models/CustomerModel");
const { validationResult } = require("express-validator");

const companyModel = new CompanyModel();
const customerModel = new CustomerModel();
const moment = require("moment");

const { formatTicketForPhase } = require("../helpers/FormatTicket");

const TicketModel = require("../models/TicketModel");
const ticketModel = new TicketModel();

const CallbackDigitalk = require("../services/CallbackDigitalk");
const { ticketSLA, settingsSLA } = require("../helpers/SLAFormat");

const PhaseController = require("../controllers/PhaseController");
const phaseController = new PhaseController();
class CustomerController {
  async create(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    try {
      let obj = {
        id_core: req.body.id_core,
        id_ticket: req.body.id_ticket,
        name: req.body.name,
        email: req.body.email,
        phone: req.body.phone,
        identification_document: req.body.identification_document,
        crm_ids: req.body.crm_ids,
        crm_contact_id: req.body.crm_contact_id,
        created_at: moment().format(),
        updated_at: moment().format(),
      };

      const result = await customerModel.create(obj);

      if (result.length <= 0)
        return res
          .status(400)
          .send({ error: "Error when manage customer info", result: result });

      if (result.code == "23502")
        return res.status(400).send({ error: "Please check your body" });

      obj.created_at = moment(obj.created_at).format("DD/MM/YYYY HH:mm:ss");
      obj.updated_at = moment(obj.updated_at).format("DD/MM/YYYY HH:mm:ss");
      let ticket = await ticketModel.getTicketById(
        req.body.id_ticket,
        req.headers.authorization
      );
      ticket = await formatTicketForPhase(
        { id: ticket[0].phase_id },
        ticket[0]
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
      return res.status(200).send(obj);
    } catch (err) {
      console.log("Error when manager customer info => ", err);
      return res
        .status(400)
        .send({ error: "Error when manager customer info" });
    }
  }

  async getByID(req, res) {
    try {
      const result = await customerModel.getTicketByIDCRMCustomer(
        req.query.status,
        req.params.id,
        req.query.department
      );
      if (result.length <= 0)
        return res.status(400).send({ error: "Without customer with this ID" });

      const phases = [];
      for await (const x of result) {
        console.log();
        if (phases.filter((y) => y.id === x.id).length <= 0) {
          x.phase_sla = await settingsSLA(x.id);
          x.sla = await ticketSLA(x.id, x.id_ticket);

          x.header = await phaseController.headerGenerate({
            id: x.id,
            authorization: req.body.authorization,
            customer: req.params.id,
          });

          phases.push({
            id: x.id,
            department: x.id_department_core,
            emoji: phases.icon,
            sla: x.phase_sla,
            name: x.name,
            order: x.order,
            created_at: x.created_at,
            updated_at: x.updated_at,
            header: x.header,
            ticket: [
              {
                closed: x.closed,
                sla: x.sla,
                department_origin: x.department_origin,
                display_name: x.display_name,
                id: x.id,
                id_seq: x.id_seq,
                id_user: x.id_user,
                status: x.status,
                start_ticket: x.start_ticket
                  ? moment(x.start_ticket).format("DD/MM/YYYY HH:mm:ss")
                  : "",
                created_at: moment(x.created_at_ticket).format(
                  "DD/MM/YYYY HH:mm:ss"
                ),
                updated_at: moment(x.updated_at_ticket).format(
                  "DD/MM/YYYY HH:mm:ss"
                ),
              },
            ],
          });
        } else {
          phases.filter((y) => {
            if (y.id === x.id) {
              y.ticket.push({
                closed: x.closed,
                department_origin: x.department_origin,
                display_name: x.display_name,
                id: x.id,
                sla: x.sla,
                id_seq: x.id_seq,
                id_user: x.id_user,
                status: x.status,
                start_ticket: x.start_ticket
                  ? moment(x.start_ticket).format("DD/MM/YYYY HH:mm:ss")
                  : "",
                created_at: moment(x.created_at_ticket).format(
                  "DD/MM/YYYY HH:mm:ss"
                ),
                updated_at: moment(x.updated_at_ticket).format(
                  "DD/MM/YYYY HH:mm:ss"
                ),
              });
            }
          });
        }
      }
      return res.status(200).send(phases);
    } catch (err) {
      console.log("Error when get company info => ", err);
      return res.status(400).send({ error: "Error when get company info" });
    }
  }

  async getByIDCore(req, res) {
    try {
      const result = await customerModel.getByIDCore(req.params.id_core);
      if (result.length <= 0)
        return res.status(400).send({ error: "Error when get company info" });

      result[0].created_at = moment(result[0].created_at).format(
        "DD/MM/YYYY HH:mm:ss"
      );
      result[0].updated_at = moment(result[0].updated_at).format(
        "DD/MM/YYYY HH:mm:ss"
      );

      return res.status(200).send(result);
    } catch (err) {
      console.log("Error when get company info => ", err);
      return res.status(400).send({ error: "Error when get company info" });
    }
  }

  async getByTicket(req, res) {
    try {
      const result = await customerModel.getAll(req.body.id_ticket);
      if (result.length <= 0) return res.status(400).send({ error: result });

      result[0].created_at = moment(result[0].created_at).format(
        "DD/MM/YYYY HH:mm:ss"
      );
      result[0].updated_at = moment(result[0].updated_at).format(
        "DD/MM/YYYY HH:mm:ss"
      );

      return res.status(200).send(result);
    } catch (err) {
      console.log("Error when get company info => ", err);
      return res.status(400).send({ error: "Error when get company info" });
    }
  }

  async update(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    try {
      let obj = {
        name: req.body.name,
        email: req.body.email,
        phone: req.body.phone,
        identification_document: req.body.identification_document,
        crm_ids: req.body.crm_ids,
        crm_contact_id: req.body.crm_contact_id,
        updated_at: moment().format(),
      };

      const result = await customerModel.update(obj, req.params.id);
      if (result.name && result.name == "error")
        return res
          .status(500)
          .send({ error: "Contact microservice responsible" });

      return res.status(200).send(result);
    } catch (err) {
      console.log("Error when manage object to update company => ", err);
      return res
        .status(400)
        .send({ error: "Error when manage object to update company" });
    }
  }
}

module.exports = CustomerController;
