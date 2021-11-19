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

const { counter_sla, settingsSLA } = require("../helpers/SLAFormat");
class PhaseController {
  async create(req, res) {
    // Validação do corpo da requisição.
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    try {
      const usersResponsible = [];
      const usersNotify = [];

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

      await redis.del(`ticket:phase:${req.headers.authorization}`);

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
      const type = await typeColumnModel.getTypeByID(formatcolumn.type);
      formatcolumn.type = type[0].name;
    }

    return formTemplate;
  }

  async _phaseSLASettings(obj, idPhase) {
    const keys = Object.keys(obj);

    const slaSettings = async function (sla, type) {
      const timeType = await unitOfTimeModel.checkUnitOfTimeByName(
        sla.unit_of_time
      );
      if (!timeType || timeType.length <= 0 || !sla.active || sla.time <= 0) {
        return false;
      }

      await slaModel.slaPhaseSettings({
        id_phase: idPhase,
        id_sla_type: type,
        id_unit_of_time: timeType,
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

      result[0].department_can_create_protocol =
        result[0].department_can_create_protocol &&
        result[0].department_can_create_protocol.department
          ? result[0].department_can_create_protocol.department
          : [];
      result[0].department_can_create_ticket =
        result[0].department_can_create_ticket &&
        result[0].department_can_create_ticket.department
          ? result[0].department_can_create_ticket.department
          : [];
      result[0].separate =
        result[0].separate && result[0].separate.separate
          ? result[0].separate.separate
          : null;

      const departments = await phaseModel.getDepartmentPhase(result[0].id);
      result[0].department = departments[0].id_department;

      const tickets = await ticketModel.getTicketByPhase(result[0].id);
      result[0].ticket = [];
      for await (let ticket of tickets) {
        const ticketFormated = await formatTicketForPhase(result[0], ticket);
        result[0].ticket.push(ticketFormated);
      }

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
        result = await phaseModel.getAllPhase(req.headers.authorization);

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
        for (let i in result) {
          const tickets = await ticketModel.searchTicket(
            req.headers.authorization,
            search,
            result[i].id
          );
          result[i].ticket = [];
          for await (let ticket of tickets) {
            result[i].ticket.push(
              await formatTicketForPhase(result[i], ticket)
            );
          }
          result[i] = await this._formatPhase(result[i], req.app.locals.db);
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
          result[i].department_can_create_protocol =
            result[i].department_can_create_protocol &&
            result[i].department_can_create_protocol.department
              ? result[i].department_can_create_protocol.department
              : [];
          result[i].department_can_create_ticket =
            result[i].department_can_create_ticket &&
            result[i].department_can_create_ticket.department
              ? result[i].department_can_create_ticket.department
              : [];
          result[i].separate =
            result[i].separate && result[i].separate.separate
              ? result[i].separate.separate
              : null;

          const tickets = await ticketModel.getTicketByPhase(
            result[i].id,
            search
          );
          result[i].ticket = [];
          result[i].open = 0;
          result[i].closed = 0;
          for await (let ticket of tickets) {
            result[i].ticket.push(
              await formatTicketForPhase(result[i], ticket)
            );
            ticket.closed
              ? (result[i].closed = result[i].closed + 1)
              : (result[i].open = result[i].open + 1);
          }
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
      phase.department_can_create_protocol =
        phase.department_can_create_protocol &&
        phase.department_can_create_protocol.department
          ? phase.department_can_create_protocol.department
          : [];
      phase.department_can_create_ticket =
        phase.department_can_create_ticket &&
        phase.department_can_create_ticket.department
          ? phase.department_can_create_ticket.department
          : [];
      phase.separate =
        phase.separate && phase.separate.separate
          ? phase.separate.separate
          : null;

      const tickets = await ticketModel.getTicketByPhaseAndStatus(
        phase.id,
        status
      );

      phase.ticket = [];

      phase.open = await ticketModel.countTicket(phase.id, false);
      phase.closed = await ticketModel.countTicket(phase.id, true);
      for await (let ticket of tickets) {
        phase.ticket.push(await formatTicketForPhase(phase, ticket));
      }

      phase.counter_sla = await counter_sla(phase.id);
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

      let obj = {
        icon: req.body.icon,
        name: req.body.name,
        responsible_notify_sla: req.body.notify_responsible,
        supervisor_notify_sla: req.body.notify_supervisor,
        updated_at: moment().format(),
        active: req.body.active,
        visible_new_ticket: req.body.visible_new_ticket,
      };

      await phaseModel.updatePhase(
        obj,
        req.params.id,
        req.headers.authorization
      );
      obj.id = req.params.id;

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

  async _formatPhase(result, mongodb) {
    const department = await phaseModel.getDepartmentPhase(result.id);

    department.length > 0
      ? (result.department = department[0].id_department)
      : 0;

    const responsibles = await phaseModel.getResponsiblePhase(result.id);
    result.responsible = [];
    responsibles.map((value) => result.responsible.push(value.id_user_core));

    const notify = await phaseModel.getNotifiedPhase(result.id);
    result.notify = [];
    notify.map((value) => result.notify.push(value.id_user_core));

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
      await phaseModel.updatePhase(
        { active: req.body.active },
        req.params.id,
        req.headers.authorization
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

      return res.status(200).send(req.body);
    } catch (err) {
      console.log("Erro ao ordenar as fases =>", err);
      return res
        .status(500)
        .send({ error: "Houve um erro ordenar as fases do workflow" });
    }
  }
}

module.exports = PhaseController;
