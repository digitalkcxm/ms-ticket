import DashModel from '../models/DashModel.js'

export default class DashController {
  constructor(database = {}) {
    this.dashModel = new DashModel(database)
  }

  async dashGenerateV2(data) {
    if (!data.id) return false //@info data.id é o id do departamento.
    if (!data.authorization) return false //@info data.authorization é a company do cliente.

    //@info sem essas duas infos acima é impossivel montar o dash.
    const total_de_fases = await this.dashModel.total_phase(data.id, data.authorization)
    const total_tickets = await this.dashModel.total_tickets(data.id, data.authorization)

    //Não iniciados
      const total_tickets_nao_iniciados = await this.dashModel.total_tickets_nao_iniciado(data.id, data.authorization)
      const total_tickets_nao_iniciados_em_dia = await this.dashModel.total_tickets_nao_iniciados_em_dia(data.id, data.authorization)
      const total_tickets_nao_iniciados_atrasado = await this.dashModel.total_tickets_nao_iniciados_atrasado(data.id, data.authorization)
      const total_tickets_nao_iniciados_sem_sla =
      parseInt(total_tickets_nao_iniciados) - (parseInt(total_tickets_nao_iniciados_em_dia) + parseInt(total_tickets_nao_iniciados_atrasado))
    //Fim não iniciados

    // Iniciados
      let total_tickets_iniciados = await this.dashModel.total_tickets_iniciados(data.id, data.authorization)
      const total_tickets_iniciados_sem_resposta_emdia = await this.dashModel.total_tickets_iniciados_sem_resposta_emdia(
        data.id,
        data.authorization
      )
      const total_tickets_iniciados_sem_resposta_atrasado = await this.dashModel.total_tickets_iniciados_sem_resposta_atrasado(
        data.id,
        data.authorization
      )
      const total_tickets_respondido_emdia = await this.dashModel.total_tickets_respondido_emdia(data.id, data.authorization)
      const total_tickets_respondido_atrasado = await this.dashModel.total_tickets_respondido_atrasado(data.id, data.authorization)
      const total_ticket_iniciados_sem_sla =
      parseInt(total_tickets_iniciados) -
        (parseInt(total_tickets_iniciados_sem_resposta_emdia) +
        parseInt(total_tickets_iniciados_sem_resposta_atrasado) +
        parseInt(total_tickets_respondido_emdia) +
        parseInt(total_tickets_respondido_atrasado))

      const total_tickets_respondidos_sem_conclusao = parseInt(total_tickets_respondido_emdia) +
      parseInt(total_tickets_respondido_atrasado)
      total_tickets_iniciados = total_tickets_iniciados - total_tickets_respondidos_sem_conclusao 
    // Fim iniciados.

    //Concluidos
      const total_tickets_fechados = await this.dashModel.total_tickets_fechados(data.id, data.authorization)
      const total_tickets_concluidos_emdia = await this.dashModel.total_tickets_concluidos_emdia(data.id, data.authorization)
      const total_tickets_concluidos_atrasado = await this.dashModel.total_tickets_concluidos_atrasado(data.id, data.authorization)
      const total_tickets_concluidos_sem_sla = (parseInt(total_tickets_fechados) - (parseInt(total_tickets_concluidos_emdia) + parseInt(total_tickets_concluidos_atrasado)))
    //Fim Concluidos


    //Calc percentual
    const calc_percentual = async function (total, value) {
      if (total == 0) return 0

      return ((parseInt(value) * 100) / parseInt(total)).toFixed(2)
    }
    const percentual_nao_iniciado = {
      total: await calc_percentual(total_tickets, total_tickets_nao_iniciados),
      emdia: await calc_percentual(total_tickets_nao_iniciados, total_tickets_nao_iniciados_em_dia),
      atrasado: await calc_percentual(total_tickets_nao_iniciados, total_tickets_nao_iniciados_atrasado),
      sem_sla: await calc_percentual(total_tickets_nao_iniciados, total_tickets_nao_iniciados_sem_sla)
    }
    const percentual_iniciado_sem_resposta = {
      total: await calc_percentual(total_tickets, total_tickets_iniciados),
      emdia: await calc_percentual(total_tickets_iniciados, total_tickets_iniciados_sem_resposta_emdia),
      atrasado: await calc_percentual(total_tickets_iniciados, total_tickets_iniciados_sem_resposta_atrasado),
      sem_sla: await calc_percentual(total_tickets_iniciados, total_ticket_iniciados_sem_sla),
    }
    const percentual_respondido_sem_conclusao = {
      total: await calc_percentual(total_tickets, total_tickets_respondidos_sem_conclusao),
      emdia: await calc_percentual(total_tickets_respondidos_sem_conclusao, total_tickets_respondido_emdia),
      atrasado: await calc_percentual(total_tickets_respondidos_sem_conclusao, total_tickets_respondido_atrasado),
      sem_sla: 0
    }
    const percentual_concluido = {
      total: await calc_percentual(total_tickets, total_tickets_fechados),
      emdia: await calc_percentual(total_tickets_fechados, total_tickets_concluidos_emdia),
      atrasado: await calc_percentual(total_tickets_fechados, total_tickets_concluidos_atrasado),
      sem_sla: await calc_percentual(total_tickets_fechados, total_tickets_concluidos_sem_sla),
    }

    const obj = {
      percentual_concluido,
      percentual_iniciado_sem_resposta,
      percentual_nao_iniciado,
      percentual_respondido_sem_conclusao,
      tickets_concluidos:{
        emdia:total_tickets_concluidos_emdia,
        atrasado: total_tickets_concluidos_atrasado,
        sem_sla: total_tickets_concluidos_sem_sla
      },
      tickets_iniciados_sem_resposta:{
        emdia:total_tickets_iniciados_sem_resposta_emdia,
        atrasado: total_tickets_iniciados_sem_resposta_atrasado,
        sem_sla: total_ticket_iniciados_sem_sla
      },
      tickets_nao_iniciados:{
        emdia:total_tickets_nao_iniciados_em_dia,
        atrasado: total_tickets_nao_iniciados_atrasado,
        sem_sla: total_tickets_nao_iniciados_sem_sla
      },
      tickets_respondidos_sem_conclusao:{
        emdia:total_tickets_respondido_emdia,
        atrasado: total_tickets_respondido_atrasado,
        sem_sla: 0
      },
      total_de_fases,
      total_tickets,
      total_tickets_fechados,
      total_tickets_iniciados,
      total_tickets_nao_iniciados,
      total_tickets_respondidos_sem_conclusao,
    }
    console.log('=>',obj)
    
    return obj
  }
}
