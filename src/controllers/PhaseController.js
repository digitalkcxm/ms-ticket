const redis = require("async-redis").createClient(
  process.env.REDIS_PORT,
  process.env.REDIS_HOST
);

const { v1 } = require("uuid");

const moment = require("moment");

const PhaseModel = require("../models/PhaseModel");
const phaseModel = new PhaseModel();

const UserController = require("./UserController");
const userController = new UserController();

const TicketModel = require("../models/TicketModel");
const ticketModel = new TicketModel();

const FormTemplate = require("../documents/FormTemplate");
const FormDocuments = require("../documents/FormDocuments");

const UnitOfTimeModel = require("../models/UnitOfTimeModel");
const unitOfTimeModel = new UnitOfTimeModel();

const DepartmentController = require("./DepartmentController");
const departmentController = new DepartmentController();

const templateValidate = require("../helpers/TemplateValidate");
const { formatTicketForPhase } = require("../helpers/FormatTicket");

const { validationResult } = require("express-validator");

const DepartmentModel = require("../models/DepartmentModel");
const departmentModel = new DepartmentModel();

const ActivitiesModel = require("../models/ActivitiesModel");
const activitiesModel = new ActivitiesModel();

const SLAModel = require("../models/SLAModel");
const slaModel = new SLAModel();

const TypeColumnModel = require("../models/TypeColumnModel");
const typeColumnModel = new TypeColumnModel();

const { counter_sla, settingsSLA, ticketSLA } = require("../helpers/SLAFormat");
const CallbackDigitalk = require("../services/CallbackDigitalk");

class PhaseController {
  async create(req, res) {
    // Validação do corpo da requisição.
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    try {
      // const usersResponsible = [];
      // const usersNotify = [];

      let obj = {
        id: v1(),
        id_company: req.headers.authorization,
        icon: req.body.icon,
        name: req.body.name,
        form: req.body.form,
        created_at: moment().format(),
        updated_at: moment().format(),
        active: req.body.active,
        visible_new_ticket: req.body.visible_new_ticket,
        notification_customer: req.body.customer,
        notification_admin: req.body.admin,
        notification_separate: { separate: req.body.separate },
        department_can_create_protocol: {
          department: req.body.department_can_create_protocol,
        },
        department_can_create_ticket: {
          department: req.body.department_can_create_ticket,
        },
        create_protocol: req.body.create_protocol,
        create_ticket: req.body.create_ticket,
      };
      // Executa uma validação no formulario passado pelo cliente.
      if (req.body.form) {
        const templateValidate = await this._formPhase(
          req.body.column,
          req.app.locals.db
        );

        if (!templateValidate) {
          return res.status(400).send({ errors: templateValidate });
        }

        obj.id_form_template = templateValidate;
      }

      // Cria a estrutura base da fase.
      let phaseCreated = await phaseModel.createPhase(obj);
      if (
        !Array.isArray(phaseCreated) ||
        (Array.isArray(phaseCreated) && phaseCreated.length <= 0)
      ) {
        return res.status(400).send({ errors: "Erro ao criar a fase!" });
      }

      // Realiza uma verificação com o id do departamento e depois gera a ligação com a fase.
      await this._departmentPhaseLinked(
        req.body.department,
        req.headers.authorization,
        obj.id
      );

      // Realiza uma verificação com o id do usuario responsavel pela fase, e depois vincula os dois.
      // if (
      //   req.body.separate &&
      //   Array.isArray(req.body.separate) &&
      //   req.body.separate.length > 0
      // ) {
      //   for await (const contact of req.body.separate) {
      //     let result;

      //     if(contact.id){
      //       result = await userController.checkUserCreated(
      //         contact.id,
      //         req.headers.authorization,
      //         contact.name
      //       );
      //     }else if(contact.email){
      //      result =  checkEmailCreated(contact.email,   req.headers.authorization)
      //     }

      //     usersResponsible.push(result.id);
      //   }
      //   await this._responsiblePhase(obj.id, usersResponsible);
      //   obj.responsible = req.body.responsible;
      // }

      // Realiza uma verificação com o id do usuario pela fase, e depois vincula os dois.
      // if (
      //   req.body.notify &&
      //   Array.isArray(req.body.notify) &&
      //   req.body.notify.length > 0
      // ) {
      //   for await (const notify of req.body.notify) {
      //     let result;
      //     result = await userController.checkUserCreated(
      //       notify,
      //       req.headers.authorization,
      //       notify.name
      //     );
      //     usersNotify.push(result.id);
      //   }
      //   obj.notify = req.body.notify;

      //   await this._notifyPhase(obj.id, usersNotify, usersResponsible);
      // }

      // Registra a configuração de SLA da fase.
      if (req.body.sla) {
        await this._phaseSLASettings(req.body.sla, obj.id);
      }

      // Formata o obj de retorno.
      delete obj.id_company;

      obj.column = req.body.column;
      obj.created_at = moment(obj.created_at).format("DD/MM/YYYY HH:mm:ss");
      obj.updated_at = moment(obj.updated_at).format("DD/MM/YYYY HH:mm:ss");
      obj.ticket = [];
      obj.header = {};

      obj.sla = await settingsSLA(obj.id);
      obj = await this._formatPhase(obj, req.app.locals.db);

      await redis.del(`ticket:phase:${req.headers.authorization}`);
      await CallbackDigitalk(
        {
          type: "socket",
          channel: `wf_department_${req.body.department}`,
          event: "new_phase",
          obj,
        },
        req.company[0].callback
      );

      return res.status(200).send(obj);
    } catch (err) {
      console.log("Error when manage phase create => ", err);
      return res.status(400).send({ error: "Error when manage phase create" });
    }
  }

  async _departmentPhaseLinked(department, authorization, phaseId) {
    const result = await departmentController.checkDepartmentCreated(
      department,
      authorization
    );
    await phaseModel.linkedDepartment({
      id_department: result[0].id,
      id_phase: phaseId,
      active: true,
    });
  }

  async _formPhase(column, db) {
    const errorsColumns = await templateValidate(column);
    if (errorsColumns.length > 0) return errorsColumns;

    const formTemplate = await new FormTemplate(db).createRegister(column);

    if (!formTemplate) return false;

    for (const formatcolumn of column) {
      console.log(formatcolumn);
      const type = await typeColumnModel.getTypeByID(formatcolumn.type);
      formatcolumn.type = type[0].name;
    }

    return formTemplate;
  }

  async _phaseSLASettings(obj, idPhase) {
    const keys = Object.keys(obj);

    const slaSettings = async function (sla, type) {
      // const timeType = await unitOfTimeModel.checkUnitOfTime(sla.unit_of_time);
      // if (!timeType || timeType.length <= 0 || !sla.active || sla.time <= 0) {
      //   return false;
      // }

      await slaModel.slaPhaseSettings({
        id_phase: idPhase,
        id_sla_type: type,
        id_unit_of_time: sla.unit_of_time,
        time: sla.time,
        active: sla.active,
      });
      return true;
    };

    keys.map((key) => {
      switch (key) {
        case "1":
          slaSettings(obj[key], key);
          break;
        case "2":
          slaSettings(obj[key], key);
          break;
        case "3":
          slaSettings(obj[key], key);
          break;
        default:
          return false;
      }
    });
  }

  async getPhaseByID(req, res) {
    try {
      const result = await phaseModel.getPhaseById(
        req.params.id,
        req.headers.authorization
      );
      if (!result || result.length < 0)
        return res.status(400).send({ error: "Invalid id phase" });

      const departments = await phaseModel.getDepartmentPhase(result[0].id);
      result[0].department = departments[0].id_department;

      result[0].ticket = [];
      result[0].header = {};

      result[0].sla = await settingsSLA(result[0].id);
      result[0] = await this._formatPhase(result[0], req.app.locals.db);
      return res.status(200).send(result);
    } catch (err) {
      console.log("PhaseController -> getPhaseByID -> err", err);
      return res.status(400).send({ error: "There was an error" });
    }
  }

  async getAllPhase(req, res) {
    const search = req.query.search ? req.query.search : "";
    let result;
    try {
      if (search) {
        const department_id = await departmentModel.getByID(
          req.query.department,
          req.headers.authorization
        );
        if (department_id && department_id.length <= 0) return false;

        result = await phaseModel.getAllPhasesByDepartmentID(
          department_id[0].id
        );
        // result = await phaseModel.getAllPhase(req.headers.authorization);

        // if (isNaN(search)) {
        //   const searchMongo = await new FormDocuments(
        //     req.app.locals.db
        //   ).searchRegister(search);

        //   for (let i in result) {
        //     result[i].ticket = [];

        //     for (const mongoResult of searchMongo) {
        //       let ticket = await ticketModel.getTicketByIDForm(
        //         mongoResult._id,
        //         result[i].id
        //       );
        //       if (ticket)
        //         result[i].ticket.push(
        //           await formatTicketForPhase(result[i], ticket)
        //         );
        //     }
        //     result[i] = await this._formatPhase(result[i], req.app.locals.db);
        //   }
        // } else {
        console.log("====>QUERY ===>", req.query);
        for (let i in result) {
          const tickets = await ticketModel.searchTicket(
            req.headers.authorization,
            search,
            result[i].id,
            req.query.status
          );
          result[i].header = {};
          result[i].ticket = [];
          result[i].header.total_tickets = tickets.length;

          for await (let ticket of tickets) {
            result[i].ticket.push(
              await formatTicketForPhase(result[i], ticket)
            );
          }
          result[i] = await this._formatPhase(
            result[i],
            req.app.locals.db,
            true
          );
        }
        // }
      } else if (req.query.department) {
        result = await this._queryDepartment(
          req.query.department,
          req.headers.authorization,
          req.query.status,
          req.app.locals.db
        );
      } else {
        result = await phaseModel.getAllPhase(req.headers.authorization);

        for (let i in result) {
          result[i].ticket = [];
          result[i].header = {};

          result[i] = await this._formatPhase(result[i], req.app.locals.db);
        }

        await redis.set(
          `ticket:phase:${req.headers.authorization}`,
          JSON.stringify(result)
        );
      }
      return res.status(200).send(result);
    } catch (err) {
      console.log("Get all phase => ", err);
      return res.status(400).send({ error: "There was an error" });
    }
  }

  async getBySocket(req, res) {
    try {
    } catch (err) {
      console.log("err =>", err);
    }
    const department_id = await departmentModel.getByID(
      req.params.id,
      req.headers.authorization
    );
    if (department_id && department_id.length <= 0) return false;

    let result = await phaseModel.getAllPhasesByDepartmentID(
      department_id[0].id
    );
    for (let phase of result) {
      phase.header.total_tickets = tickets.length;

      phase.sla = await settingsSLA(phase.id);

      phase = await this._formatPhase(phase, req.app.locals.db);
    }
    return res.status(200).send(result);
  }
  // departments = JSON.parse(departments)
  async _queryDepartment(department, authorization, status, db) {
    const department_id = await departmentModel.getByID(
      department,
      authorization
    );
    if (department_id && department_id.length <= 0) return false;

    let result = await phaseModel.getAllPhasesByDepartmentID(
      department_id[0].id
    );
    for (let phase of result) {
      phase.ticket = [];
      phase.header = {};

      phase.sla = await settingsSLA(phase.id);

      phase = await this._formatPhase(phase, db);
    }

    return result;
  }

  async updatePhase(req, res) {
    // const errors = validationResult(req)
    // if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })
    try {
      const usersResponsible = [];
      const usersNotify = [];

      const dpt = [];
console.log("req.body.separate  ===>",req.body.separate )
      let obj = {
        icon: req.body.icon,
        name: req.body.name,
        responsible_notify_sla: req.body.notify_responsible,
        supervisor_notify_sla: req.body.notify_supervisor,
        updated_at: moment().format(),
        active: req.body.active,
        visible_new_ticket: req.body.visible_new_ticket,
        notification_customer: req.body.customer,
        notification_admin: req.body.admin,
        notification_separate: { separate: req.body.separate },
        department_can_create_protocol: {
          department: req.body.department_can_create_protocol,
        },
        department_can_create_ticket: {
          department: req.body.department_can_create_ticket,
        },
        create_protocol: req.body.create_protocol,
        create_ticket: req.body.create_ticket,
      };

      const oldPhase = await phaseModel.getPhaseById(req.params.id,req.headers.authorization);
      if (!oldPhase || oldPhase.length <= 0)
        return res
          .status(400)
          .send({ error: "Error when manage phase update" });

      await phaseModel.updatePhase(
        obj,
        req.params.id,
        req.headers.authorization
      );
      obj.id = req.params.id;

      if (obj.active != oldPhase[0].active) {
        await CallbackDigitalk(
          {
            type: "socket",
            channel: `wf_department_${req.body.department}`,
            event: "change_active_phase",
            obj: { id: req.params.id, active: obj.active },
          },
          req.company[0].callback
        );
      }
      // let result = await departmentController.checkDepartmentCreated(
      //   req.body.department,
      //   req.headers.authorization
      // );

      // let departmentLinkedWithPhase = await phaseModel.selectLinkedDepartment(
      //   req.params.id
      // );
      // if (departmentLinkedWithPhase.length <= 0)
      //   return res
      //     .status(400)
      //     .send({ error: "Phase without linked department" });

      // if (departmentLinkedWithPhase[0].id_department != result[0].id) {
      await this._departmentPhaseLinked(
        req.body.department,
        req.headers.authorization,
        req.params.id
      );
      //   await phaseModel.linkedDepartment({
      //     id_department: result[0].id,
      //     id_phase: req.params.id,
      //     active: true,
      //   });
      // }
      if (
        req.body.responsible &&
        Array.isArray(req.body.responsible) &&
        req.body.responsible.length > 0
      ) {
        for await (const responsible of req.body.responsible) {
          let resultUser;
          resultUser = await userController.checkUserCreated(
            responsible,
            req.headers.authorization,
            responsible.name
          );
          usersResponsible.push(resultUser.id);
        }
        await this._responsiblePhase(req.params.id, usersResponsible);
        obj.responsible = req.body.responsible;
      }

      if (
        req.body.notify &&
        Array.isArray(req.body.notify) &&
        req.body.notify.length > 0
      ) {
        for await (const notify of req.body.notify) {
          let resultUser;
          resultUser = await userController.checkUserCreated(
            notify,
            req.headers.authorization,
            notify.name
          );
          usersNotify.push(resultUser.id);
        }

        await this._notifyPhase(req.params.id, usersNotify, usersResponsible);
        obj.notify = req.body.notify;
      }

      // Registra a configuração de SLA da fase.
      if (req.body.sla) {
        await this._phaseSLASettings(req.body.sla, obj.id);
      }

      let phase = await phaseModel.getPhaseById(
        req.params.id,
        req.headers.authorization
      );
      if (req.body.form && req.body.column) {
        let validations = await this._checkColumnsFormTemplate(
          req.body.column,
          req.app.locals.db,
          phase[0].id_form_template
        );
        if (validations.length > 0)
          return res.status(400).send({ error: validations });

        validations.column = req.body.column;
        await new FormTemplate(req.app.locals.db).updateRegister(
          validations._id,
          validations
        );
        phase[0].department = req.body.department;
        phase[0].formTemplate = req.body.column;
        delete phase[0].id_form_template;
      }

      await redis.del(`ticket:phase:${req.headers.authorization}`);
      return res.status(200).send(phase);
    } catch (err) {
      console.log("Error when manage phase update => ", err);
      return res.status(400).send({ error: "Error when manage phase update" });
    }
  }

  async _responsiblePhase(phase_id, usersResponsible) {
    try {
      await phaseModel.delResponsiblePhase(phase_id);

      if (usersResponsible.length > 0) {
        usersResponsible.map(async (user) => {
          await phaseModel.createResponsiblePhase({
            id_phase: phase_id,
            id_user: user,
            id_type_of_responsible: 1,
          });
        });
      }
    } catch (err) {
      console.log("Error responsible Phase => ", err);
      return err;
    }
  }

  async _notifyPhase(phase_id, usersNotify, usersResponsible) {
    try {
      await phaseModel.delNotifyPhase(phase_id);

      if (usersNotify.length > 0) {
        usersNotify.map(async (user) => {
          console.log("User", user);
          await phaseModel.createNotifyPhase({
            id_phase: phase_id,
            id_user: user,
          });
        });
      }
    } catch (err) {
      console.log("Error notify Phase => ", err);
      return err;
    }
  }

  async _checkColumnsFormTemplate(newTemplate, db, template) {
    const register = await new FormTemplate(db).findRegistes(template);
    const errors = [];
    if (newTemplate.length < register.column.length)
      errors.push(
        "Não é possivel remover campos do formulario, apenas inativa-los"
      );

    register.column.map((valueA) => {
      let validate = 0;
      newTemplate.map((valueB) =>
        valueA.column == valueB.column ? validate++ : ""
      );
      console.log(validate, valueA.label);

      if (validate <= 0)
        errors.push(
          `A coluna ${valueA.label} não pode ser removido ou o valor do campo column não pode ser alterado, apenas inativado`
        );

      if (validate > 1)
        errors.push(
          `A coluna ${valueA.label} não pode ser igual a um ja criado`
        );
    });
    if (errors.length > 0) return errors;

    return register;
  }

  async _formatPhase(result, mongodb, search = false) {
    const department = await phaseModel.getDepartmentPhase(result.id);

    department.length > 0
      ? (result.department = department[0].id_department)
      : 0;

    if (result.id_form_template) {
      const register = await new FormTemplate(mongodb).findRegistes(
        result.id_form_template
      );

      if (register && register.column) {
        result.formTemplate = register.column;

        for (const x of result.formTemplate) {
          const type = await typeColumnModel.getTypeByID(x.type);

          type && Array.isArray(type) && type.length > 0
            ? (x.type = type[0].name)
            : "";
        }
      }
    }
    if (!search) {
      const tickets = await ticketModel.getTicketByPhase(result.id);

      for await (let ticket of tickets) {
        result.ticket.push(await formatTicketForPhase(result, ticket));
        // if (ticket) const getByPhaseTicket(id_phase, id_ticket);
      }
      result.header.total_tickets = tickets.length;
    }
    result.department_can_create_protocol &&
    result.department_can_create_protocol.department
      ? (result.department_can_create_protocol =
          result.department_can_create_protocol.department)
      : (result.department_can_create_protocol = []);

    result.department_can_create_ticket &&
    result.department_can_create_ticket.department
      ? (result.department_can_create_ticket =
          result.department_can_create_ticket.department)
      : (result.department_can_create_ticket = []);

    result.separate && result.separate.separate
      ? (result.separate = result.separate.separate)
      : (result.separate = null);

    result.header.open_tickets = await ticketModel.countTicket(
      result.id,
      false
    );
    result.header.closed_tickets = await ticketModel.countTicket(
      result.id,
      true
    );
    if (result.header.open_tickets != "0") {
      result.header.percent_open_tickets = (
        (parseInt(result.header.open_tickets) * 100) /
        parseInt(result.header.total_tickets)
      ).toFixed(2);
    } else {
      result.header.percent_open_tickets = 0.0;
    }

    if (result.header.closed_tickets != "0") {
      result.header.percent_closed_tickets = (
        (parseInt(result.header.closed_tickets) * 100) /
        parseInt(result.header.total_tickets)
      ).toFixed(2);
    } else {
      result.header.percent_closed_tickets = 0;
    }

    result.header.counter_sla = await counter_sla(result.id);
    result.header.counter_sla_closed = await counter_sla(result.id, true);

    result.created_at = moment(result.created_at).format("DD/MM/YYYY HH:mm:ss");
    result.updated_at = moment(result.updated_at).format("DD/MM/YYYY HH:mm:ss");
    delete result.id_form_template;
    return result;
  }

  async getAllPhaseForCache(req, res) {
    try {
      const result = await this._getByDepartment(
        req.query.departments,
        req.headers.authorization,
        req.app.locals.db
      );

      return res.status(200).send(result);
    } catch (err) {
      return res.status(400).send({ error: "There was an error" });
    }
  }

  async _getByDepartment(departments, authorization, db) {
    try {
      //departments = JSON.parse(departments)
      if (departments.length > 0 && Array.isArray(departments)) {
        let phases;
        for (const department of departments) {
          phases.concat(
            await this._phaseForCache(department, authorization, db)
          );
        }
        return phases;
      } else {
        return await this._phaseForCache(departments, authorization, db);
      }
    } catch (err) {
      console.log(err);
      return { error: "Houve algum erro ao captar o departamento pelo id" };
    }
  }

  async _phaseForCache(departments, authorization, db) {
    const phases = [];
    const department_id = await departmentModel.getByID(
      departments,
      authorization
    );
    if (department_id && department_id.length <= 0) return false;

    const result = await phaseModel.getPhasesByDepartmentID(
      department_id[0].id
    );
    for (const phase of result) {
      if (phase.id_form_template && phase.form) {
        const register = await new FormTemplate(db).findRegistes(
          phase.id_form_template
        );
        if (register && register.column) phase.formTemplate = register.column;

        delete phase.id_form_template;
      }
      phase.department = departments;
      phases.push(phase);
    }
    return phases;
  }

  async disablePhase(req, res) {
    try {
      const result = await phaseModel.getPhaseById(
        req.params.id,
        req.headers.authorization
      );
      if (!result || result.length < 0)
        return res.status(400).send({ error: "Invalid id phase" });

      const departments = await phaseModel.getDepartmentPhase(result[0].id);
      result[0].department = departments[0].id_department;

      result[0].ticket = [];
      result[0].header = {};

      result[0].sla = await settingsSLA(result[0].id);
      // await phaseModel.updatePhase(
      //   { active: req.body.active },
      //   req.params.id,
      //   req.headers.authorization
      // );
      console.log("teste", result[0]);
      await CallbackDigitalk(
        {
          type: "socket",
          channel: `wf_department_${result[0].department}`,
          event: "disable_phase",
          obj: { id: req.params.id, active: req.body.active },
        },
        req.company[0].callback
      );

      return res.status(200).send({ status: "ok" });
    } catch (err) {
      console.log(err);
      return res.status(400).send({ error: "Error when disable phase" });
    }
  }

  async closeMassive(req, res) {
    try {
      //Verifica se o id do usuario está sendo passado no body da requisição.
      if (!req.body.id_user) {
        console.log("Error ===> Sem ID do usuário");
        return res.status(400).send({ error: "Whitout id_user" });
      }

      //Faz a verificação de usuario, caso ele não exista ele cria na base.
      let user = await userController.checkUserCreated(
        req.body.id_user,
        req.headers.authorization,
        req.body.name_user
      );

      //Verifica se ocorreu algum erro na checagem de usuario.
      if (!user || !user.id) {
        console.log("Error ===> Ocorreu algum erro na checagem do usuario");
        return res
          .status(400)
          .send({ error: "Ocorreu algum erro na checagem de usuario" });
      }

      //Faz o get dos tickets pelo id da fase.
      const tickets = await ticketModel.getTicketByPhase(req.params.id, "");

      //Retorna um erro caso a fase não contenha tickets na fase.
      if (tickets.length <= 0) {
        console.log("Error ===> Não há tickets ativos");
        return res
          .status(400)
          .send({ error: "Não há tickets ativos nessa phase" });
      }

      //Faz um laço de repetição finalizando todos os tickets relacionados a phase.
      for (const ticket of tickets) {
        if (!ticket.closed) {
          await ticketModel.closedTicket(ticket.id);

          //Cria uma atividade para registrar a ação do usuario
          let obj = {
            text: `Ticket finalizado massivamente pelo usuario ${req.body.name_user}`,
            id_ticket: ticket.id,
            id_user: user.id,
            created_at: moment().format(),
            updated_at: moment().format(),
          };

          await activitiesModel.create(obj);
        }
      }

      return res.status(200).send({ msg: "OK" });
    } catch (err) {
      console.log("Error ====> " + err);
      return res
        .status(500)
        .send({ error: "Houve um erro ao finalizar os tickets" });
    }
  }

  async transferMassive(req, res) {
    try {
      //Verifica se a nova fase dos tickets é valido e existe dentro do banco de dados
      const newPhase = await phaseModel.getPhaseById(
        req.body.new_phase,
        req.headers.authorization
      );
      if (newPhase.length <= 0)
        return res.status(400).send({ error: "Id da phase invalido" });

      //Verifica se o id do usuario está sendo passado no body da requisição.
      if (!req.body.id_user) {
        console.log("Error ===> Não foi passado o ID do usuário");
        return res.status(400).send({ error: "Whitout id_user" });
      }

      //Faz a verificação de usuario, caso ele não exista ele cria na base.
      let user = await userController.checkUserCreated(
        req.body.id_user,
        req.headers.authorization,
        req.body.name_user
      );

      //Verifica se ocorreu algum erro na checagem de usuario.
      if (!user || !user.id) {
        console.log("Error ===> O erro foi na checagem de usuário");
        return res
          .status(400)
          .send({ error: "Ocorreu algum erro na checagem de usuario" });
      }

      //Faz o get dos tickets pelo id da fase.
      const tickets = await ticketModel.getTicketByPhase(req.params.id, "");

      //Retorna um erro caso a fase não contenha tickets na fase.
      if (tickets.length <= 0) {
        console.log("Error ===> Não há tickets ativos nessa phase");
        return res
          .status(400)
          .send({ error: "Não há tickets ativos nessa phase" });
      }

      //Faz um laço de repetição finalizando todos os tickets relacionados a phase.
      for (const ticket of tickets) {
        //Desativa o registro da fase atual.
        await phaseModel.disablePhaseTicket(ticket.id);

        //Cria um novo registro com a nova fase.
        await ticketModel.createPhaseTicket({
          id_phase: req.body.new_phase,
          id_ticket: ticket.id,
        });

        //Cria uma atividade para registrar a ação do usuario.
        let obj = {
          text: `Ticket transferido massivamente pelo usuario ${req.body.name_user} para a fase ${newPhase[0].name}`,
          id_ticket: ticket.id,
          id_user: user.id,
          created_at: moment().format(),
          updated_at: moment().format(),
        };

        await activitiesModel.create(obj);
      }

      //console.log("Finalizou o laço");

      return res.status(200).send({ msg: "OK" });
    } catch (err) {
      console.log("Error ====> " + err);
      return res
        .status(500)
        .send({ error: "Houve um erro ao mover os tickets" });
    }
  }

  async orderPhase(req, res) {
    try {
      if (!req.params.id)
        return res
          .status(400)
          .send({ error: "É obrigatorio a informação do departamento" });

      if (!Array.isArray(req.body) && req.body.length <= 0)
        return res
          .status(400)
          .send({ error: "O array deve conter os ids das fases" });

      const check = await phaseModel.getPhasesIN(
        req.body,
        req.params.id,
        req.headers.authorization
      );

      if (
        !Array.isArray(check) ||
        (Array.isArray(check) && req.body.length != check.length)
      )
        return res
          .status(400)
          .send({ error: "Houve um erro ordenar as fases do workflow" });

      console.log("check ==>", check);
      req.body.map(async (value, index) => {
        const obj = { order: index };
        await phaseModel.updatePhase(obj, value, req.headers.authorization);
        return true;
      });

      await CallbackDigitalk(
        {
          type: "socket",
          channel: `wf_department_${req.params.id}`,
          event: "new_order_phase",
          obj: req.body,
        },
        req.company[0].callback
      );

      return res.status(200).send(req.body);
    } catch (err) {
      console.log("Erro ao ordenar as fases =>", err);
      return res
        .status(500)
        .send({ error: "Houve um erro ordenar as fases do workflow" });
    }
  }

  async dash(req, res) {
    try {
      if (!req.params.id)
        return res.status(400).send({ error: "Houve algum problema!" });

      const result = await phaseModel.dash(
        req.params.id,
        req.headers.authorization
      );
      result.total_tickets_nao_iniciados = 0;
      result.tickets_nao_iniciados = {
        emdia: 0,
        atrasado: 0,
        sem_sla: 0,
      };
      result.total_tickets_iniciados_sem_resposta = 0;
      result.tickets_iniciados_sem_resposta = {
        emdia: 0,
        atrasado: 0,
        sem_sla: 0,
      };

      result.total_tickets_respondidos_sem_conclusao = 0;
      result.tickets_respondidos_sem_conclusao = {
        emdia: 0,
        atrasado: 0,
        sem_sla: 0,
      };

      result.tickets_concluidos = {
        emdia: 0,
        atrasado: 0,
        sem_sla: 0,
      };

      console.log("TOTAL =>", result.tickets.length);
      let n_iniciado = 0
      let iniciados = 0
      let concluidos = 0
      for await (const ticket of result.tickets) {

        if(ticket.id_status === 2){
          iniciados = iniciados + 1
        }
        if(ticket.id_status === 3){
          concluidos = concluidos + 1
        }

        const phaseSettings = await slaModel.getSLASettings(ticket.id_phase);         

        if (phaseSettings && phaseSettings.length > 0) {
          const sla_ticket = await slaModel.getForDash(
            ticket.id_phase,
            ticket.id
          );
          if(ticket.id_status === 1){
            console.log("LOG --->",ticket,"settings===>,", phaseSettings, "SLA ==>",sla_ticket)
            n_iniciado = n_iniciado + 1
          }
          if(sla_ticket && sla_ticket.length> 0){
            for await (const sla of sla_ticket) {
              switch (sla.id_sla_type) {
                case 1:
                  console.log("sla===>",sla.active, ticket.id_status, sla.id)
                  if (sla.active) {
                    result.total_tickets_nao_iniciados =
                      result.total_tickets_nao_iniciados + 1;
                    if (sla.id_sla_status == 1) {
                      result.tickets_nao_iniciados.emdia =
                        result.tickets_nao_iniciados.emdia + 1;
                    } else if (sla.id_sla_status == 2) {
                      result.tickets_nao_iniciados.atrasado =
                        result.tickets_nao_iniciados.atrasado + 1;
                    }
                  } else {
                    const nextSLA = sla_ticket.filter(
                      (x) => x.id_sla_type === 2 || x.id_sla_type === 3
                    );
  
                    if (nextSLA.length <= 0) {
                      switch (ticket.id_status) {
                        case 2:
                          const firstInteraction =
                            await ticketModel.first_interaction(ticket.id);
                          if (firstInteraction && firstInteraction.length <= 0) {
                            result.total_tickets_iniciados_sem_resposta =
                              result.total_tickets_iniciados_sem_resposta + 1;
                            result.tickets_iniciados_sem_resposta.sem_sla =
                              result.tickets_iniciados_sem_resposta.sem_sla + 1;
                          } else {
                            result.total_tickets_respondidos_sem_conclusao =
                              result.total_tickets_respondidos_sem_conclusao + 1;
                            result.tickets_respondidos_sem_conclusao.sem_sla =
                              result.tickets_respondidos_sem_conclusao.sem_sla +
                              1;
                          }
  
                          break;
                        case 3:
                          result.tickets_concluidos.sem_sla =
                            result.tickets_concluidos.sem_sla + 1;
                          break;
                        default:
                          break;
                      }
                    }
                  }
                  break;
                case 2:
                  if (!sla.interaction_time) {
                    result.total_tickets_iniciados_sem_resposta =
                      result.total_tickets_iniciados_sem_resposta + 1;
                    if (sla.id_sla_status === 1) {
                      result.tickets_iniciados_sem_resposta.emdia =
                        result.tickets_iniciados_sem_resposta.emdia + 1;
                    } else {
                      result.tickets_iniciados_sem_resposta.atrasado =
                        result.tickets_iniciados_sem_resposta.atrasado + 1;
                    }
                  } else {
                    const nextSLA = sla_ticket.filter(
                      (x) => x.id_sla_type === 3 && x.active
                    );
                    nextSLA;
                    if (nextSLA.length > 0) {
                      result.total_tickets_respondidos_sem_conclusao =
                        result.total_tickets_respondidos_sem_conclusao + 1;
                      if (nextSLA[0].id_sla_status === 2) {
                        result.tickets_respondidos_sem_conclusao.atrasado =
                          result.tickets_respondidos_sem_conclusao.atrasado + 1;
                      } else {
                        result.tickets_respondidos_sem_conclusao.emdia =
                          result.tickets_respondidos_sem_conclusao.emdia + 1;
                      }
                    }
                  }
                  break;
                case 3:
                  if (!sla.active) {
                    const nextSLA = sla_ticket.filter(
                      (x) => x.id_sla_type === 2 && x.interaction_time
                    );
                    if (nextSLA.length > 0) {
                      if (sla.id_sla_status === 1) {
                        result.tickets_concluidos.emdia =
                          result.tickets_concluidos.emdia + 1;
                      } else if (sla.id_sla_status === 2) {
                        result.tickets_concluidos.atrasado =
                          result.tickets_concluidos.atrasado + 1;
                      }
                    }
                  }
                  break;
  
                default:
                  break;
              }
            }
          }else{
            switch (ticket.id_status) {
              case 1:
                result.total_tickets_nao_iniciados =
                  result.total_tickets_nao_iniciados + 1;
                result.tickets_nao_iniciados.sem_sla =
                  result.tickets_nao_iniciados.sem_sla + 1;
                break;
              case 2:
                const firstInteraction = await ticketModel.first_interaction(
                  ticket.id
                );
                if (firstInteraction && firstInteraction.length <= 0) {
                  result.total_tickets_iniciados_sem_resposta =
                    result.total_tickets_iniciados_sem_resposta + 1;
  
                  result.tickets_iniciados_sem_resposta.sem_sla =
                    result.tickets_iniciados_sem_resposta.sem_sla + 1;
                } else {
                  result.total_tickets_respondidos_sem_conclusao =
                    result.total_tickets_respondidos_sem_conclusao + 1;
  
                  result.tickets_respondidos_sem_conclusao.sem_sla =
                    result.tickets_respondidos_sem_conclusao.sem_sla + 1;
                }
  
                break;
              case 3:
                result.tickets_concluidos.sem_sla =
                  result.tickets_concluidos.sem_sla + 1;
                break;
              default:
                break;
            }
          }

        } else {
          switch (ticket.id_status) {
            case 1:
              result.total_tickets_nao_iniciados =
                result.total_tickets_nao_iniciados + 1;
              result.tickets_nao_iniciados.sem_sla =
                result.tickets_nao_iniciados.sem_sla + 1;
              break;
            case 2:
              const firstInteraction = await ticketModel.first_interaction(
                ticket.id
              );
              if (firstInteraction && firstInteraction.length <= 0) {
                result.total_tickets_iniciados_sem_resposta =
                  result.total_tickets_iniciados_sem_resposta + 1;

                result.tickets_iniciados_sem_resposta.sem_sla =
                  result.tickets_iniciados_sem_resposta.sem_sla + 1;
              } else {
                result.total_tickets_respondidos_sem_conclusao =
                  result.total_tickets_respondidos_sem_conclusao + 1;

                result.tickets_respondidos_sem_conclusao.sem_sla =
                  result.tickets_respondidos_sem_conclusao.sem_sla + 1;
              }

              break;
            case 3:
              result.tickets_concluidos.sem_sla =
                result.tickets_concluidos.sem_sla + 1;
              break;
            default:
              break;
          }
        }
      }
      console.log("n_iniciado",n_iniciado)
      console.log("iniciados",iniciados)
      console.log("concluidos",concluidos)

      const calc_percentual = async function (total, value) {
        if (total == 0) return 0;

        return ((parseInt(value) * 100) / parseInt(total)).toFixed(2);
      };
      result.percentual_nao_iniciado = {
        total: await calc_percentual(
          result.total_tickets,
          result.total_tickets_nao_iniciados
        ),
        emdia: await calc_percentual(
          result.total_tickets_nao_iniciados,
          result.tickets_nao_iniciados.emdia
        ),
        atrasado: await calc_percentual(
          result.total_tickets_nao_iniciados,
          result.tickets_nao_iniciados.atrasado
        ),
        sem_sla: await calc_percentual(
          result.total_tickets_nao_iniciados,
          result.tickets_nao_iniciados.sem_sla
        ),
      };
      result.percentual_iniciado_sem_resposta = {
        total: await calc_percentual(
          result.total_tickets,
          result.total_tickets_iniciados_sem_resposta
        ),
        emdia: await calc_percentual(
          result.total_tickets_iniciados_sem_resposta,
          result.tickets_iniciados_sem_resposta.emdia
        ),
        atrasado: await calc_percentual(
          result.total_tickets_iniciados_sem_resposta,
          result.tickets_iniciados_sem_resposta.atrasado
        ),
        sem_sla: await calc_percentual(
          result.total_tickets_iniciados_sem_resposta,
          result.tickets_iniciados_sem_resposta.sem_sla
        ),
      };
      result.percentual_respondido_sem_conclusao = {
        total: await calc_percentual(
          result.total_tickets,
          result.total_tickets_respondidos_sem_conclusao
        ),
        emdia: await calc_percentual(
          result.total_tickets_respondidos_sem_conclusao,
          result.tickets_respondidos_sem_conclusao.emdia
        ),
        atrasado: await calc_percentual(
          result.total_tickets_respondidos_sem_conclusao,
          result.tickets_respondidos_sem_conclusao.atrasado
        ),
        sem_sla: await calc_percentual(
          result.total_tickets_respondidos_sem_conclusao,
          result.tickets_respondidos_sem_conclusao.sem_sla
        ),
      };
      result.percentual_concluido = {
        total: await calc_percentual(
          result.total_tickets,
          result.total_tickets_fechados
        ),
        emdia: await calc_percentual(
          result.total_tickets_fechados,
          result.tickets_concluidos.emdia
        ),
        atrasado: await calc_percentual(
          result.total_tickets_fechados,
          result.tickets_concluidos.atrasado
        ),
        sem_sla: await calc_percentual(
          result.total_tickets_fechados,
          result.tickets_concluidos.sem_sla
        ),
      };

      delete result.tickets;
      delete result.phases;
      return res.status(200).send(result);
    } catch (err) {
      console.log(err);
      return res.status(500).send({ error: "Houve algum problema!" });
    }
  }

  async filter(req, res) {
    try {
      console.log("FILTER", req.query);
      if (!req.query.department)
        return res.status(500).send({ error: "Houve um erro" });

      const tickets = await phaseModel.filter(
        req.query.department,
        req.headers.authorization
      );
      let obj = [];
      if (req.query.type) {
        switch (req.query.type) {
          case "tickets_nao_iniciados":
            console.log("Teste =================");
            for await (const ticket of tickets) {
              const phaseSettings = await slaModel.getSLASettings(
                ticket.id_phase
              );
              if (phaseSettings && phaseSettings.length > 0) {
                const sla_ticket = await slaModel.getForDash(
                  ticket.id_phase,
                  ticket.id
                );
                for await (const sla of sla_ticket) {
                  if (sla.id_sla_type === 1) {
                    if (sla.active) {
                      if (sla.id_sla_status == 1) {
                        if (
                          req.query.sla === "emdia" ||
                          req.query.sla === "undefined"
                        )
                          obj.push(ticket);
                      } else if (sla.id_sla_status == 2) {
                        if (
                          req.query.sla === "atrasado" ||
                          req.query.sla === "undefined"
                        )
                          obj.push(ticket);
                      }
                    }
                  }
                }
              } else {
                console.log("SEM SLA=>", ticket);
                if (ticket.id_status === 1) {
                  if (
                    req.query.sla === "sem_sla" ||
                    req.query.sla === "undefined"
                  )
                    obj.push(ticket);
                }
              }
            }
            break;
          case "tickets_iniciados_sem_resposta":
            for await (const ticket of tickets) {
              const phaseSettings = await slaModel.getSLASettings(
                ticket.id_phase
              );
              if (phaseSettings && phaseSettings.length > 0) {
                const sla_ticket = await slaModel.getForDash(
                  ticket.id_phase,
                  ticket.id
                );
                for await (const sla of sla_ticket) {
                  switch (sla.id_sla_type) {
                    case 1:
                      if (!sla.active) {
                        const nextSLA = sla_ticket.filter(
                          (x) => x.id_sla_type === 2 || x.id_sla_type === 3
                        );
                        if (nextSLA.length <= 0) {
                          if (ticket.id_status === 2) {
                            const firstInteraction =
                              await ticketModel.first_interaction(ticket.id);
                            if (
                              firstInteraction &&
                              firstInteraction.length <= 0
                            ) {
                              if (
                                req.query.sla === "sem_sla" ||
                                req.query.sla === "undefined"
                              )
                                obj.push(ticket);
                            }
                          }
                        }
                      }
                      break;
                    case 2:
                      if (!sla.interaction_time) {
                        if (sla.id_sla_status === 1) {
                          if (
                            req.query.sla === "emdia" ||
                            req.query.sla === "undefined"
                          )
                            obj.push(ticket);
                        } else {
                          if (
                            req.query.sla === "atrasado" ||
                            req.query.sla === "undefined"
                          )
                            obj.push(ticket);
                        }
                      }
                  }
                }
              } else {
                if (ticket.id_status === 2) {
                  const firstInteraction = await ticketModel.first_interaction(
                    ticket.id
                  );
                  if (firstInteraction && firstInteraction.length <= 0) {
                    if (
                      req.query.sla === "sem_sla" ||
                      req.query.sla === "undefined"
                    )
                      obj.push(ticket);
                  }
                }
              }
            }
            break;
          case "tickets_respondidos_sem_conclusao":
            for await (const ticket of tickets) {
              const phaseSettings = await slaModel.getSLASettings(
                ticket.id_phase
              );
              if (phaseSettings && phaseSettings.length > 0) {
                const sla_ticket = await slaModel.getForDash(
                  ticket.id_phase,
                  ticket.id
                );
                for await (const sla of sla_ticket) {
                  switch (sla.id_sla_type) {
                    case 1:
                      if (!sla.active) {
                        const nextSLA = sla_ticket.filter(
                          (x) => x.id_sla_type === 2 || x.id_sla_type === 3
                        );
                        if (nextSLA.length <= 0) {
                          if (ticket.id_status === 2) {
                            const firstInteraction =
                              await ticketModel.first_interaction(ticket.id);
                            if (
                              firstInteraction &&
                              firstInteraction.length > 0
                            ) {
                              if (
                                req.query.sla === "sem_sla" ||
                                req.query.sla === "undefined"
                              )
                                obj.push(ticket);
                            }
                          }
                        }
                      }
                    case 2:
                      if (sla.interaction_time) {
                        const nextSLA = sla_ticket.filter(
                          (x) => x.id_sla_type === 3 && x.active
                        );

                        if (nextSLA.length > 0) {
                          if (nextSLA[0].id_sla_status === 2) {
                            if (
                              req.query.sla === "atrasado" ||
                              req.query.sla === "undefined"
                            )
                              obj.push(ticket);
                          } else {
                            if (
                              req.query.sla === "emdia" ||
                              req.query.sla === "undefined"
                            )
                              obj.push(ticket);
                          }
                        }
                      }
                  }
                }
              } else {
                if (ticket.id_status === 2) {
                  const firstInteraction = await ticketModel.first_interaction(
                    ticket.id
                  );
                  if (firstInteraction && firstInteraction.length > 0) {
                    if (
                      req.query.sla === "sem_sla" ||
                      req.query.sla === "undefined"
                    )
                      obj.push(ticket);
                  }
                }
              }
            }
            break;
          case "tickets_concluidos":
            for await (const ticket of tickets) {
              const phaseSettings = await slaModel.getSLASettings(
                ticket.id_phase
              );
              if (phaseSettings && phaseSettings.length > 0) {
                const sla_ticket = await slaModel.getForDash(
                  ticket.id_phase,
                  ticket.id
                );
                for await (const sla of sla_ticket) {
                  if (sla.id_sla_type === 1) {
                    if (!sla.active) {
                      const nextSLA = sla_ticket.filter(
                        (x) => x.id_sla_type === 2 || x.id_sla_type === 3
                      );

                      if (nextSLA.length <= 0) {
                        if (ticket.id_status === 3) {
                          if (
                            req.query.sla === "sem_sla" ||
                            req.query.sla === "undefined"
                          )
                            obj.push(ticket);
                        }
                      }
                    } else if (sla.id_sla_type === 3) {
                      if (!sla.active) {
                        const nextSLA = sla_ticket.filter(
                          (x) => x.id_sla_type === 2 && x.interaction_time
                        );
                        if (nextSLA.length > 0) {
                          if (sla.id_sla_status === 1) {
                            if (
                              req.query.sla === "emdia" ||
                              req.query.sla === "undefined"
                            )
                              obj.push(ticket);
                          } else if (sla.id_sla_status === 2) {
                            if (
                              req.query.sla === "atrasado" ||
                              req.query.sla === "undefined"
                            )
                              obj.push(ticket);
                          }
                        }
                      }
                    }
                  }
                }
              } else {
                if (ticket.id_status === 3) {
                  if (
                    req.query.sla === "sem_sla" ||
                    req.query.sla === "undefined"
                  )
                    obj.push(ticket);
                }
              }
            }
            break;
          default:
            break;
        }
      } else {
        obj = tickets;
      }

      for (let i in obj) {
        obj[i] = await ticketModel.getTicketById(
          obj[i].id,
          req.headers.authorization
        );
        obj[i] = await formatTicketForPhase(
          { id: obj[i][0].phase_id },
          obj[i][0]
        );
      }
      return res.status(200).send(obj);
    } catch (err) {
      console.log("Erro ao filtrar os dados", err);
      return res.status(500).send({ error: "Houve um erro" });
    }
  }
}

module.exports = PhaseController;
