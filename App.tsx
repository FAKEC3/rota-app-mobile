
import React, { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import { ID, Query } from "appwrite";
import * as appwriteConfig from "./appwrite";

const {
  tablesDB,
  APPWRITE_DATABASE_ID,
  APPWRITE_CLIENTES_TABLE_ID,
  APPWRITE_PEDIDOS_TABLE_ID,
} = appwriteConfig as any;
const APPWRITE_EXTINTORES_TABLE_ID = (appwriteConfig as any).APPWRITE_EXTINTORES_TABLE_ID || "";

const CHAVE_CLIENTES = "rota_clientes_backup";
const CHAVE_PEDIDOS = "rota_pedidos_backup";
const CHAVE_EXTINTORES = "rota_extintores_backup";

/**
 * PERFIL ATUAL
 * vendedor = não pode excluir pedido
 * admin = pode excluir pedido
 */
const PERFIL_ATUAL: "vendedor" | "admin" = "vendedor";

const CATALOGO: Record<string, Record<string, number>> = {
  "Recarga de extintor": {
    "Recarga de 2º nível do extintor PQS (BC-02KG)": 90,
    "Recarga de 2º nível do extintor PQS (BC-04KG)": 70,
    "Recarga de 2º nível do extintor PQS (BC-06KG)": 80,
    "Recarga de 2º nível do extintor PQS (BC-08KG)": 90,
    "Recarga de 2º nível do extintor PQS (BC-12KG)": 110,
    "Recarga de 2º nível do extintor PQS (ABC-02KG)": 90,
    "Recarga de 2º nível do extintor PQS (ABC-04KG)": 90,
    "Recarga de 2º nível do extintor PQS (ABC-06KG)": 120,
    "Recarga de 2º nível do extintor PQS (ABC-08KG)": 130,
    "Recarga de 2º nível do extintor PQS (ABC-12KG)": 150,
    "Recarga de 2º nível do extintor CO2 (04KG)": 120,
    "Recarga de 2º nível do extintor CO2 (06KG)": 160,
    "Recarga de 2º nível do extintor AP (10L)": 90,
  },
  "Extintor novo": {
    "Extintor BC 4kg novo": 220,
    "Extintor BC 6kg novo": 240,
    "Extintor ABC 4kg novo": 240,
    "Extintor ABC 6kg novo": 280,
    "Extintor CO2 4kg novo": 480,
    "Extintor AP 10L novo": 260,
  },
  "Acessórios e serviços": {
    "Suporte de piso": 45,
    "Placa fotoluminescente": 25,
    "Teste hidrostático": 85,
    "Manutenção em mangueira": 140,
  },
};

type Aba =
  | "dashboard"
  | "pedido"
  | "historico"
  | "clientes"
  | "cadastro"
  | "extintores";

type ClienteForm = {
  nome: string;
  tipo: "juridica" | "fisica";
  cnpj: string;
  cpf: string;
  whatsapp: string;
  endereco: string;
  numero: string;
  bairro: string;
  cidade: string;
  email?: string;
};

type ClienteData = ClienteForm & {
  id: string;
  $id?: string;
};

type PedidoItem = {
  id: string;
  servico: string;
  item: string;
  qtd: number;
  unit: number;
  total: number;
};

type ExtintorGeradoData = {
  id: string;
  tipo: string;
  capacidade: string;
  local: string;
  numeroSerie: string;
  vencimento: string;
  observacoes: string;
};

type PedidoData = {
  id: string;
  rowId?: string;
  pedido_codigo: string;
  clienteId: string;
  clienteNome: string;
  dataServico: string;
  detalhes: string;
  itens: PedidoItem[];
  total: number;
  status: string;
  extintoresGerados?: ExtintorGeradoData[];
};

type ExtintorData = {
  id: string;
  rowId?: string;
  clienteId: string;
  clienteNome: string;
  tipo: string;
  capacidade: string;
  local: string;
  numeroSerie: string;
  vencimento: string;
  observacoes: string;
};

const clienteInicial: ClienteForm = {
  nome: "",
  tipo: "juridica",
  cnpj: "",
  cpf: "",
  whatsapp: "",
  endereco: "",
  numero: "",
  bairro: "",
  cidade: "",
  email: "",
};

const itemInicial = {
  servico: "",
  item: "",
  qtd: 1,
  unit: "",
};

const pedidoInicial = {
  clienteId: "",
  clienteNome: "",
  dataServico: hojeISO(),
  detalhes: "",
  status: "Em atendimento",
  itens: [] as PedidoItem[],
};

const extintorInicial: Omit<ExtintorData, "id" | "rowId" | "clienteNome"> = {
  clienteId: "",
  tipo: "",
  capacidade: "",
  local: "",
  numeroSerie: "",
  vencimento: "",
  observacoes: "",
};

const theme = {
  bg: "#0f0f10",
  bgSoft: "#17181b",
  card: "#ffffff",
  cardSoft: "#f7f7f8",
  cardAlt: "#fbfbfc",
  text: "#161616",
  textSoft: "#5b5f68",
  textMuted: "#7b818c",
  border: "#e7e8eb",
  borderDark: "#2a2d34",
  primary: "#cf2027",
  primaryDark: "#a6171d",
  accent: "#f2c230",
  accentDark: "#cfa11b",
  black: "#121212",
  white: "#ffffff",
  successBg: "#ebfff1",
  successText: "#167a3d",
  warningBg: "#fff8e5",
  warningText: "#8a5a00",
  dangerBg: "#fff0f0",
  dangerText: "#b42318",
  infoBg: "#f4f6f8",
  shadow: "0 18px 45px rgba(0,0,0,0.08)",
  shadowSoft: "0 10px 24px rgba(0,0,0,0.05)",
};

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function idLocal() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function moeda(v: number) {
  return Number(v || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function numero(v: string | number) {
  if (typeof v === "number") return v;
  const n = String(v || "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const parsed = Number(n);
  return Number.isFinite(parsed) ? parsed : 0;
}

function ler<T>(k: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(k);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function gravar(k: string, v: unknown) {
  localStorage.setItem(k, JSON.stringify(v));
}

function somenteDigitos(v: string) {
  return String(v || "").replace(/\D/g, "");
}

function whatsappLimpo(v: string) {
  return somenteDigitos(v);
}

function formatarCnpj(v: string) {
  const d = somenteDigitos(v).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function formatarCpf(v: string) {
  const d = somenteDigitos(v).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

function formatarWhatsapp(v: string) {
  const d = somenteDigitos(v).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function formatarDocumento(cliente: Partial<ClienteData>) {
  if (cliente.tipo === "fisica") return formatarCpf(cliente.cpf || "");
  return formatarCnpj(cliente.cnpj || "");
}

function formatarDocumentoBruto(tipo: "juridica" | "fisica", valor: string) {
  return tipo === "fisica" ? formatarCpf(valor) : formatarCnpj(valor);
}

function iniciaisNome(nome: string) {
  const partes = String(nome || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!partes.length) return "RT";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return `${partes[0][0]}${partes[1][0]}`.toUpperCase();
}

function normalizarClienteBanco(row: any): ClienteData {
  const documento = somenteDigitos(row.cnpj || "");
  return {
    id: row.$id || row.id || "",
    $id: row.$id || row.id || "",
    nome: row.nome || "",
    tipo: row.tipo_pessoa === "fisica" ? "fisica" : "juridica",
    cnpj: row.tipo_pessoa === "fisica" ? "" : documento,
    cpf: row.tipo_pessoa === "fisica" ? documento : "",
    whatsapp: somenteDigitos(row.whatsapp || ""),
    endereco: row.rua || "",
    numero: row.numero || "",
    bairro: row.bairro || "",
    cidade: row.cidade || "",
    email: row.email || "",
  };
}

function normalizarPedidoBanco(row: any): PedidoData {
  let detalhesObj: any = {};
  try {
    detalhesObj = row.detalhes ? JSON.parse(row.detalhes) : {};
  } catch {
    detalhesObj = {};
  }

  const itens: PedidoItem[] = Array.isArray(detalhesObj.itens)
    ? detalhesObj.itens.map((i: any) => ({
        id: i.id || idLocal(),
        servico: i.servico || "",
        item: i.item || "",
        qtd: Number(i.qtd || 1),
        unit: Number(i.unit || 0),
        total: Number(i.total || 0),
      }))
    : [];

  return {
    id: row.pedido_codigo || row.$id || idLocal(),
    rowId: row.$id || "",
    pedido_codigo: row.pedido_codigo || row.$id || "",
    clienteId: row.cliente_id || detalhesObj.clienteId || "",
    clienteNome: row.cliente_nome || detalhesObj.clienteNome || "",
    dataServico: row.data_servico || detalhesObj.dataServico || hojeISO(),
    detalhes: detalhesObj.detalhes || "",
    itens,
    total:
      Number(row.total || 0) ||
      itens.reduce((s, i) => s + Number(i.total || 0), 0),
    status: row.status || detalhesObj.status || "Em atendimento",
    extintoresGerados: Array.isArray(detalhesObj.extintoresGerados)
      ? detalhesObj.extintoresGerados.map((ext: any) => ({
          id: ext.id || idLocal(),
          tipo: ext.tipo || "",
          capacidade: ext.capacidade || "",
          local: ext.local || "",
          numeroSerie: ext.numeroSerie || "",
          vencimento: ext.vencimento || "",
          observacoes: ext.observacoes || "",
        }))
      : [],
  };
}

function normalizarExtintorBanco(row: any): ExtintorData {
  return {
    id: row.$id || row.id || idLocal(),
    rowId: row.$id || row.id || "",
    clienteId: row.cliente_id || "",
    clienteNome: row.cliente_nome || "",
    tipo: row.tipo || "",
    capacidade: row.capacidade || "",
    local: row.local || "",
    numeroSerie: row.numero_serie || row.numeroSerie || "",
    vencimento: row.vencimento || "",
    observacoes: row.observacoes || "",
  };
}

function extintoresBancoDisponivel() {
  return Boolean(tablesDB && APPWRITE_DATABASE_ID && APPWRITE_EXTINTORES_TABLE_ID);
}

async function listarExtintoresNoBanco() {
  if (!extintoresBancoDisponivel()) return [];
  const res = await tablesDB.listRows({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: APPWRITE_EXTINTORES_TABLE_ID,
  });
  return res.rows;
}

async function salvarExtintorNoBanco(ext: ExtintorData) {
  if (!extintoresBancoDisponivel()) return null;
  return await tablesDB.createRow({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: APPWRITE_EXTINTORES_TABLE_ID,
    rowId: ID.unique(),
    data: {
      cliente_id: ext.clienteId || null,
      cliente_nome: ext.clienteNome || null,
      tipo: ext.tipo || null,
      capacidade: ext.capacidade || null,
      local: ext.local || null,
      numero_serie: ext.numeroSerie || null,
      vencimento: ext.vencimento || null,
      observacoes: ext.observacoes || null,
    },
  });
}

async function atualizarExtintorNoBanco(rowId: string, ext: ExtintorData) {
  if (!extintoresBancoDisponivel()) return null;
  return await tablesDB.updateRow({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: APPWRITE_EXTINTORES_TABLE_ID,
    rowId,
    data: {
      cliente_id: ext.clienteId || null,
      cliente_nome: ext.clienteNome || null,
      tipo: ext.tipo || null,
      capacidade: ext.capacidade || null,
      local: ext.local || null,
      numero_serie: ext.numeroSerie || null,
      vencimento: ext.vencimento || null,
      observacoes: ext.observacoes || null,
    },
  });
}

async function excluirExtintorNoBanco(rowId: string) {
  if (!extintoresBancoDisponivel()) return null;
  return await tablesDB.deleteRow({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: APPWRITE_EXTINTORES_TABLE_ID,
    rowId,
  });
}

async function salvarOuAtualizarExtintorNoBanco(ext: ExtintorData) {
  if (!extintoresBancoDisponivel()) return null;

  if (ext.rowId) {
    return await atualizarExtintorNoBanco(ext.rowId, ext);
  }

  const numeroSerie = String(ext.numeroSerie || "").trim();

  if (numeroSerie) {
    const busca = await tablesDB.listRows({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_EXTINTORES_TABLE_ID,
      queries: [
        Query.equal("cliente_id", ext.clienteId),
        Query.equal("numero_serie", numeroSerie),
      ],
    });

    if (Array.isArray(busca.rows) && busca.rows.length > 0) {
      return await atualizarExtintorNoBanco(busca.rows[0].$id, {
        ...ext,
        rowId: busca.rows[0].$id,
      });
    }
  }

  return await salvarExtintorNoBanco(ext);
}

async function listarClientesNoBanco() {
  const res = await tablesDB.listRows({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: APPWRITE_CLIENTES_TABLE_ID,
    queries: [Query.orderAsc("nome")],
  });
  return res.rows;
}

async function salvarClienteNoBanco(cliente: ClienteForm) {
  return await tablesDB.createRow({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: APPWRITE_CLIENTES_TABLE_ID,
    rowId: ID.unique(),
    data: {
      nome: cliente.nome,
      tipo_pessoa: cliente.tipo || null,
      cnpj: cliente.tipo === "fisica" ? cliente.cpf || null : cliente.cnpj || null,
      whatsapp: cliente.whatsapp || null,
      rua: cliente.endereco || null,
      numero: cliente.numero || null,
      bairro: cliente.bairro || null,
      cidade: cliente.cidade || null,
      email: cliente.email || null,
    },
  });
}

async function atualizarClienteNoBanco(rowId: string, cliente: ClienteForm) {
  return await tablesDB.updateRow({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: APPWRITE_CLIENTES_TABLE_ID,
    rowId,
    data: {
      nome: cliente.nome,
      tipo_pessoa: cliente.tipo || null,
      cnpj: cliente.tipo === "fisica" ? cliente.cpf || null : cliente.cnpj || null,
      whatsapp: cliente.whatsapp || null,
      rua: cliente.endereco || null,
      numero: cliente.numero || null,
      bairro: cliente.bairro || null,
      cidade: cliente.cidade || null,
      email: cliente.email || null,
    },
  });
}

async function listarPedidosNoBanco() {
  const res = await tablesDB.listRows({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: APPWRITE_PEDIDOS_TABLE_ID,
  });
  return res.rows;
}

async function salvarPedidoNoBanco(
  pedido: PedidoData,
  clienteSelecionado: ClienteData | undefined
) {
  return await tablesDB.createRow({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: APPWRITE_PEDIDOS_TABLE_ID,
    rowId: ID.unique(),
    data: {
      cliente_id: pedido.clienteId || null,
      cliente_nome: clienteSelecionado?.nome || pedido.clienteNome || "",
      data_servico: pedido.dataServico || "",
      total: String(pedido.total || 0),
      status: pedido.status || "Em atendimento",
      detalhes: JSON.stringify(pedido),
      pedido_codigo: pedido.pedido_codigo || pedido.id || "",
    },
  });
}

async function atualizarStatusPedidoNoBanco(rowId: string, status: string) {
  return await tablesDB.updateRow({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: APPWRITE_PEDIDOS_TABLE_ID,
    rowId,
    data: { status },
  });
}

async function excluirPedidoNoBanco(rowId: string) {
  return await tablesDB.deleteRow({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: APPWRITE_PEDIDOS_TABLE_ID,
    rowId,
  });
}

async function buscarCnpjBrasilApi(cnpj: string) {
  const cnpjLimpo = String(cnpj || "").replace(/\D/g, "");

  if (cnpjLimpo.length !== 14) {
    throw new Error("CNPJ inválido");
  }

  const response = await fetch(
    `https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`
  );

  if (!response.ok) {
    throw new Error("Não foi possível consultar este CNPJ.");
  }

  const data = await response.json();
  return data;
}

function diferencaDias(vencimento: string) {
  if (!vencimento) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const data = new Date(`${vencimento}T00:00:00`);
  if (Number.isNaN(data.getTime())) return null;

  const diff = data.getTime() - hoje.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function statusExtintor(vencimento: string): "verde" | "laranja" | "vermelho" {
  const dias = diferencaDias(vencimento);
  if (dias === null) return "vermelho";
  if (dias < 0) return "vermelho";
  if (dias <= 30) return "laranja";
  return "verde";
}

function textoStatusExtintor(vencimento: string) {
  const dias = diferencaDias(vencimento);
  const status = statusExtintor(vencimento);

  if (dias === null) return "Data inválida";
  if (status === "vermelho") return `Vencido há ${Math.abs(dias)} dia(s)`;
  if (status === "laranja") return `Faltam ${dias} dia(s)`;
  return `Em dia • ${dias} dia(s) restantes`;
}

function corStatusExtintor(status: "verde" | "laranja" | "vermelho") {
  if (status === "verde") {
    return {
      bg: "#ebfff1",
      text: "#167a3d",
      border: "#b7e4c7",
      dot: "#22c55e",
    };
  }
  if (status === "laranja") {
    return {
      bg: "#fff8e5",
      text: "#8a5a00",
      border: "#f3dda0",
      dot: "#f59e0b",
    };
  }
  return {
    bg: "#fff0f0",
    text: "#b42318",
    border: "#f4cccc",
    dot: "#ef4444",
  };
}

function somarAnos(dataIso: string, anos: number) {
  if (!dataIso) return "";
  const data = new Date(`${dataIso}T00:00:00`);
  if (Number.isNaN(data.getTime())) return "";
  data.setFullYear(data.getFullYear() + anos);
  return data.toISOString().slice(0, 10);
}

function extrairTipoCapacidade(itemNome: string) {
  const nome = String(itemNome || "").toUpperCase();

  let tipo = "EXTINTOR";
  if (nome.includes("ABC")) tipo = "ABC";
  else if (nome.includes("BC")) tipo = "BC";
  else if (nome.includes("CO2")) tipo = "CO2";
  else if (nome.includes("AP")) tipo = "AP";

  const capacidadeMatch = nome.match(/(\d+\s?(?:KG|L))/i);
  const capacidade = capacidadeMatch ? capacidadeMatch[1].replace(/\s+/g, "") : "";

  return { tipo, capacidade };
}

function itemGeraExtintor(item: PedidoItem) {
  const nome = `${item.servico} ${item.item}`.toUpperCase();
  return ["EXTINTOR", "RECARGA", "CO2", "ABC", "BC", "AP"].some((termo) =>
    nome.includes(termo)
  );
}

function gerarExtintoresDoPedido(pedido: PedidoData): ExtintorGeradoData[] {
  const gerados: ExtintorGeradoData[] = [];

  pedido.itens.forEach((item) => {
    if (!itemGeraExtintor(item)) return;

    const qtd = Math.max(1, Number(item.qtd || 1));
    const { tipo, capacidade } = extrairTipoCapacidade(item.item);

    for (let i = 0; i < qtd; i += 1) {
      gerados.push({
        id: idLocal(),
        tipo,
        capacidade,
        local: "",
        numeroSerie: `${pedido.pedido_codigo}-${gerados.length + 1}`,
        vencimento: somarAnos(pedido.dataServico, 1),
        observacoes: `Gerado automaticamente pelo pedido ${pedido.pedido_codigo} • ${item.item}`,
      });
    }
  });

  return gerados;
}

function mesclarExtintores(
  listaAtual: ExtintorData[],
  novos: ExtintorData[]
): ExtintorData[] {
  const proximos = [...listaAtual];

  novos.forEach((ext) => {
    const chaveSerie = String(ext.numeroSerie || "").trim().toLowerCase();
    const indiceExistente = proximos.findIndex(
      (itemAtual) =>
        itemAtual.clienteId === ext.clienteId &&
        chaveSerie &&
        String(itemAtual.numeroSerie || "").trim().toLowerCase() === chaveSerie
    );

    if (indiceExistente >= 0) {
      proximos[indiceExistente] = {
        ...proximos[indiceExistente],
        ...ext,
        id: proximos[indiceExistente].id,
        rowId: ext.rowId || proximos[indiceExistente].rowId,
      };
      return;
    }

    proximos.unshift(ext);
  });

  return proximos;
}

function statusGeralCliente(extintoresCliente: ExtintorData[]) {
  if (!extintoresCliente.length) {
    return {
      status: "sem_extintor" as const,
      label: "Sem extintores",
      cor: {
        bg: theme.infoBg,
        text: theme.textSoft,
        border: theme.border,
        dot: "#94a3b8",
      },
    };
  }

  const statuses = extintoresCliente.map((ext) => statusExtintor(ext.vencimento));

  if (statuses.includes("vermelho")) {
    return {
      status: "vermelho" as const,
      label: "Extintor vencido",
      cor: corStatusExtintor("vermelho"),
    };
  }

  if (statuses.includes("laranja")) {
    return {
      status: "laranja" as const,
      label: "Vence em até 30 dias",
      cor: corStatusExtintor("laranja"),
    };
  }

  return {
    status: "verde" as const,
    label: "Extintores em dia",
    cor: corStatusExtintor("verde"),
  };
}

function formatarDataBrasil(dataIso: string) {
  if (!dataIso) return "-";
  const [ano, mes, dia] = dataIso.split("-");
  if (!ano || !mes || !dia) return dataIso;
  return `${dia}/${mes}/${ano}`;
}

const ui = {
  app: {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #f4f4f5 0%, #eceef1 100%)",
    color: theme.text,
    padding: "16px 14px 36px",
  } as React.CSSProperties,

  container: {
    width: "100%",
    maxWidth: 1180,
    margin: "0 auto",
  } as React.CSSProperties,

  hero: {
    background: `radial-gradient(circle at top, rgba(242,194,48,0.10) 0%, rgba(242,194,48,0) 28%), linear-gradient(135deg, ${theme.black} 0%, #25272b 100%)`,
    color: theme.white,
    borderRadius: 28,
    padding: "24px 20px 20px",
    boxShadow: "0 18px 55px rgba(0,0,0,0.22)",
    border: `1px solid ${theme.borderDark}`,
    marginBottom: 18,
    overflow: "hidden",
    position: "relative" as const,
  } as React.CSSProperties,

  eyebrow: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 1.8,
    textTransform: "uppercase" as const,
    color: theme.accent,
    marginBottom: 8,
  } as React.CSSProperties,

  heroTitle: {
    margin: 0,
    fontSize: "clamp(34px, 6vw, 64px)",
    lineHeight: 1,
    fontWeight: 900,
    letterSpacing: -1.4,
    color: theme.white,
    textShadow: "0 2px 10px rgba(0,0,0,0.18)",
  } as React.CSSProperties,

  heroText: {
    maxWidth: 760,
    color: "rgba(255,255,255,0.88)",
    lineHeight: 1.65,
    fontSize: 15,
    marginTop: 10,
    marginBottom: 18,
  } as React.CSSProperties,

  heroStrip: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
    marginBottom: 18,
  } as React.CSSProperties,

  heroStripCard: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 16,
    padding: "12px 14px",
    minHeight: 78,
  } as React.CSSProperties,

  heroStripLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.72)",
    fontWeight: 700,
    marginBottom: 6,
  } as React.CSSProperties,

  heroStripValue: {
    fontSize: 26,
    lineHeight: 1,
    fontWeight: 900,
    color: theme.white,
  } as React.CSSProperties,

  pageCard: {
    background: theme.card,
    borderRadius: 28,
    border: `1px solid ${theme.border}`,
    boxShadow: theme.shadow,
    padding: "18px 16px",
  } as React.CSSProperties,

  navWrap: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 10,
  } as React.CSSProperties,

  sectionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap" as const,
    marginBottom: 18,
  } as React.CSSProperties,

  sectionMini: {
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 1.8,
    textTransform: "uppercase" as const,
    color: theme.textMuted,
    marginBottom: 8,
  } as React.CSSProperties,

  sectionTitle: {
    margin: 0,
    fontSize: "clamp(26px, 4vw, 40px)",
    fontWeight: 900,
    color: theme.black,
    lineHeight: 1.08,
  } as React.CSSProperties,

  topGrid: {
    display: "grid",
    gridTemplateColumns: "1.3fr 0.7fr",
    gap: 16,
  } as React.CSSProperties,

  darkCard: {
    background: `radial-gradient(circle at top left, rgba(242,194,48,0.10) 0%, rgba(242,194,48,0) 30%), linear-gradient(135deg, ${theme.black} 0%, #24262a 100%)`,
    color: theme.white,
    borderRadius: 24,
    padding: 22,
    border: `1px solid ${theme.borderDark}`,
    boxShadow: "0 20px 45px rgba(0,0,0,0.18)",
  } as React.CSSProperties,

  darkBadge: {
    display: "inline-flex",
    alignItems: "center",
    background: "rgba(242,194,48,0.12)",
    color: theme.accent,
    border: "1px solid rgba(242,194,48,0.28)",
    borderRadius: 999,
    padding: "8px 12px",
    fontSize: 12,
    fontWeight: 800,
    marginBottom: 14,
  } as React.CSSProperties,

  darkTitle: {
    fontSize: "clamp(26px, 4vw, 46px)",
    lineHeight: 1.08,
    fontWeight: 900,
    margin: 0,
    color: theme.white,
  } as React.CSSProperties,

  darkText: {
    marginTop: 12,
    color: "rgba(255,255,255,0.88)",
    lineHeight: 1.65,
    fontSize: 14,
  } as React.CSSProperties,

  actionsCard: {
    background: theme.card,
    borderRadius: 24,
    border: `1px solid ${theme.border}`,
    padding: 20,
    boxShadow: theme.shadow,
  } as React.CSSProperties,

  actionsTitle: {
    fontSize: 22,
    fontWeight: 900,
    color: theme.black,
    marginBottom: 8,
  } as React.CSSProperties,

  actionsText: {
    fontSize: 14,
    color: theme.textSoft,
    lineHeight: 1.6,
    marginBottom: 16,
  } as React.CSSProperties,

  statGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 14,
    marginTop: 16,
  } as React.CSSProperties,

  statCard: {
    background: theme.card,
    border: `1px solid ${theme.border}`,
    borderRadius: 22,
    padding: 18,
    boxShadow: theme.shadowSoft,
    position: "relative" as const,
    overflow: "hidden",
  } as React.CSSProperties,

  statCardBar: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    width: "100%",
    height: 4,
    background: `linear-gradient(90deg, ${theme.primary} 0%, ${theme.accent} 100%)`,
  } as React.CSSProperties,

  statIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#fff7db",
    color: theme.black,
    fontSize: 24,
    marginBottom: 12,
    border: "1px solid #ffe59a",
  } as React.CSSProperties,

  statLabel: {
    fontSize: 14,
    fontWeight: 800,
    color: theme.textSoft,
    marginBottom: 8,
  } as React.CSSProperties,

  statValue: {
    fontSize: "clamp(28px, 5vw, 40px)",
    fontWeight: 900,
    color: theme.black,
    lineHeight: 1,
  } as React.CSSProperties,

  statHelp: {
    fontSize: 13,
    color: theme.textSoft,
    marginTop: 10,
    lineHeight: 1.5,
  } as React.CSSProperties,

  softGrid2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 14,
  } as React.CSSProperties,

  softCard: {
    background: theme.cardSoft,
    border: `1px solid ${theme.border}`,
    borderRadius: 20,
    padding: 18,
  } as React.CSSProperties,

  smallTitle: {
    fontSize: 18,
    fontWeight: 900,
    color: theme.black,
    marginBottom: 8,
  } as React.CSSProperties,

  smallText: {
    color: theme.textSoft,
    fontSize: 14,
    lineHeight: 1.65,
  } as React.CSSProperties,

  itemCard: {
    background: theme.card,
    border: `1px solid ${theme.border}`,
    borderRadius: 22,
    padding: 18,
    boxShadow: theme.shadowSoft,
  } as React.CSSProperties,

  clientCard: {
    background: theme.card,
    border: `1px solid ${theme.border}`,
    borderRadius: 24,
    padding: 18,
    boxShadow: theme.shadowSoft,
    position: "relative" as const,
    overflow: "hidden",
  } as React.CSSProperties,

  clientCardBar: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    width: 6,
    height: "100%",
    background: `linear-gradient(180deg, ${theme.primary} 0%, ${theme.accent} 100%)`,
  } as React.CSSProperties,

  clientHeader: {
    display: "flex",
    alignItems: "flex-start",
    gap: 14,
  } as React.CSSProperties,

  avatar: {
    width: 54,
    height: 54,
    borderRadius: 18,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: `linear-gradient(135deg, ${theme.black} 0%, #2a2d34 100%)`,
    color: theme.accent,
    fontWeight: 900,
    fontSize: 18,
    border: "1px solid rgba(242,194,48,0.22)",
    flexShrink: 0,
  } as React.CSSProperties,

  orderCard: {
    background: theme.card,
    border: `1px solid ${theme.border}`,
    borderRadius: 22,
    padding: 18,
    boxShadow: theme.shadowSoft,
    position: "relative" as const,
    overflow: "hidden",
  } as React.CSSProperties,

  orderBar: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    width: 100,
    height: 5,
    borderBottomRightRadius: 8,
    background: `linear-gradient(90deg, ${theme.primary} 0%, ${theme.accent} 100%)`,
  } as React.CSSProperties,

  input: {
    width: "100%",
    minHeight: 52,
    borderRadius: 14,
    border: `1px solid ${theme.border}`,
    background: "#fcfcfd",
    color: theme.text,
    padding: "0 14px",
    fontSize: 15,
    outline: "none",
    boxSizing: "border-box" as const,
    boxShadow: "inset 0 1px 2px rgba(0,0,0,0.03)",
  } as React.CSSProperties,

  textarea: {
    width: "100%",
    minHeight: 110,
    borderRadius: 14,
    border: `1px solid ${theme.border}`,
    background: "#fcfcfd",
    color: theme.text,
    padding: "14px",
    fontSize: 15,
    outline: "none",
    boxSizing: "border-box" as const,
    resize: "vertical" as const,
    boxShadow: "inset 0 1px 2px rgba(0,0,0,0.03)",
  } as React.CSSProperties,

  select: {
    width: "100%",
    minHeight: 52,
    borderRadius: 14,
    border: `1px solid ${theme.border}`,
    background: "#fcfcfd",
    color: theme.text,
    padding: "0 14px",
    fontSize: 15,
    outline: "none",
    boxSizing: "border-box" as const,
    boxShadow: "inset 0 1px 2px rgba(0,0,0,0.03)",
  } as React.CSSProperties,

  grid2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 14,
  } as React.CSSProperties,

  rowWrap: {
    display: "flex",
    gap: 10,
    justifyContent: "flex-end",
    flexWrap: "wrap" as const,
  } as React.CSSProperties,

  totalCard: {
    background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryDark} 100%)`,
    color: theme.white,
    borderRadius: 22,
    padding: 22,
    boxShadow: "0 18px 40px rgba(207,32,39,0.24)",
  } as React.CSSProperties,

  totalMini: {
    fontSize: 13,
    opacity: 0.9,
    marginBottom: 8,
    fontWeight: 700,
  } as React.CSSProperties,

  totalValue: {
    fontSize: "clamp(30px, 5vw, 42px)",
    fontWeight: 900,
    lineHeight: 1,
  } as React.CSSProperties,

  toolbar: {
    display: "grid",
    gridTemplateColumns: "1.2fr 0.8fr",
    gap: 12,
    marginBottom: 16,
  } as React.CSSProperties,

  msgBase: {
    marginTop: 16,
    borderRadius: 14,
    padding: "14px 16px",
    fontWeight: 700,
    border: "1px solid transparent",
  } as React.CSSProperties,
};

function getButtonStyle(
  variant: "nav" | "primary" | "secondary" | "ghost" | "danger" | "accent",
  active = false
): React.CSSProperties {
  if (variant === "nav") {
    return {
      minHeight: 46,
      padding: "0 18px",
      borderRadius: 14,
      border: `1px solid ${active ? theme.accent : "rgba(255,255,255,0.16)"}`,
      background: active ? theme.accent : "rgba(255,255,255,0.06)",
      color: active ? theme.black : theme.white,
      fontWeight: 800,
      cursor: "pointer",
      transition: "0.2s ease",
      boxShadow: active ? "0 10px 18px rgba(242,194,48,0.18)" : "none",
    };
  }

  if (variant === "primary") {
    return {
      minHeight: 48,
      padding: "0 18px",
      borderRadius: 14,
      border: `1px solid ${theme.primary}`,
      background: theme.primary,
      color: theme.white,
      fontWeight: 800,
      cursor: "pointer",
      transition: "0.2s ease",
      boxShadow: "0 12px 22px rgba(207,32,39,0.18)",
    };
  }

  if (variant === "accent") {
    return {
      minHeight: 48,
      padding: "0 18px",
      borderRadius: 14,
      border: `1px solid ${theme.accent}`,
      background: theme.accent,
      color: theme.black,
      fontWeight: 800,
      cursor: "pointer",
      transition: "0.2s ease",
      boxShadow: "0 12px 22px rgba(242,194,48,0.16)",
    };
  }

  if (variant === "danger") {
    return {
      minHeight: 48,
      padding: "0 18px",
      borderRadius: 14,
      border: `1px solid #f0c9c9`,
      background: "#fff2f2",
      color: theme.dangerText,
      fontWeight: 800,
      cursor: "pointer",
      transition: "0.2s ease",
    };
  }

  if (variant === "secondary") {
    return {
      minHeight: 48,
      padding: "0 18px",
      borderRadius: 14,
      border: `1px solid ${theme.black}`,
      background: theme.black,
      color: theme.white,
      fontWeight: 800,
      cursor: "pointer",
      transition: "0.2s ease",
      boxShadow: "0 12px 22px rgba(18,18,18,0.14)",
    };
  }

  return {
    minHeight: 48,
    padding: "0 18px",
    borderRadius: 14,
    border: `1px solid ${theme.border}`,
    background: theme.white,
    color: theme.black,
    fontWeight: 800,
    cursor: "pointer",
    transition: "0.2s ease",
  };
}

function getMensagemStyle(msg: string): React.CSSProperties {
  const texto = msg.toLowerCase();

  if (
    texto.includes("erro") ||
    texto.includes("não foi possível") ||
    texto.includes("inválido")
  ) {
    return {
      ...ui.msgBase,
      background: theme.dangerBg,
      color: theme.dangerText,
      borderColor: "#f5c2c7",
    };
  }

  if (texto.includes("buscando")) {
    return {
      ...ui.msgBase,
      background: theme.warningBg,
      color: theme.warningText,
      borderColor: "#f3dda0",
    };
  }

  return {
    ...ui.msgBase,
    background: theme.successBg,
    color: theme.successText,
    borderColor: "#b7e4c7",
  };
}

function statusBadge(status: string): React.CSSProperties {
  if (status === "Concluído") {
    return {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "9px 14px",
      borderRadius: 999,
      background: theme.successBg,
      color: theme.successText,
      fontWeight: 800,
      fontSize: 13,
      border: "1px solid #b7e4c7",
    };
  }

  if (status === "Entregue") {
    return {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "9px 14px",
      borderRadius: 999,
      background: "#fff7db",
      color: "#725300",
      fontWeight: 800,
      fontSize: 13,
      border: "1px solid #ffe08a",
    };
  }

  if (status === "Cancelado") {
    return {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "9px 14px",
      borderRadius: 999,
      background: theme.dangerBg,
      color: theme.dangerText,
      fontWeight: 800,
      fontSize: 13,
      border: "1px solid #f4cccc",
    };
  }

  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "9px 14px",
    borderRadius: 999,
    background: theme.infoBg,
    color: "#394150",
    fontWeight: 800,
    fontSize: 13,
    border: `1px solid ${theme.border}`,
  };
}

function useIsMobile(breakpoint = 860) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= breakpoint : false
  );

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= breakpoint);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);

  return isMobile;
}

function BlocoTitulo({
  eyebrow,
  titulo,
  acao,
}: {
  eyebrow?: string;
  titulo: string;
  acao?: React.ReactNode;
}) {
  return (
    <div style={ui.sectionHeader}>
      <div>
        {eyebrow ? <div style={ui.sectionMini}>{eyebrow}</div> : null}
        <h2 style={ui.sectionTitle}>{titulo}</h2>
      </div>
      {acao}
    </div>
  );
}

export default function RotaAppFase2MVP() {
  const [aba, setAba] = useState<Aba>("dashboard");
  const [msg, setMsg] = useState("");
  const [clientes, setClientes] = useState<ClienteData[]>([]);
  const [pedidos, setPedidos] = useState<PedidoData[]>([]);
  const [extintores, setExtintores] = useState<ExtintorData[]>(
    ler<ExtintorData[]>(CHAVE_EXTINTORES, [])
  );

  const [clienteEditandoId, setClienteEditandoId] = useState<string | null>(null);
  const [cliente, setCliente] = useState<ClienteForm>(clienteInicial);
  const [pedido, setPedido] = useState(pedidoInicial);
  const [item, setItem] = useState(itemInicial);
  const [extintorForm, setExtintorForm] = useState(extintorInicial);

  const [buscaHistorico, setBuscaHistorico] = useState("");
  const [filtroStatusHistorico, setFiltroStatusHistorico] = useState("Todos");
  const [buscaClientes, setBuscaClientes] = useState("");
  const [buscaExtintores, setBuscaExtintores] = useState("");
  const [filtroStatusExtintor, setFiltroStatusExtintor] = useState("Todos");
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);

  const isMobile = useIsMobile();

  useEffect(() => {
    const carregarDados = async () => {
      try {
        const clientesBanco = await listarClientesNoBanco();
        setClientes(clientesBanco.map(normalizarClienteBanco));
      } catch (error) {
        console.error("Erro ao carregar clientes do Appwrite:", error);
        setClientes(ler<ClienteData[]>(CHAVE_CLIENTES, []));
      }

      try {
        const pedidosBanco = await listarPedidosNoBanco();
        setPedidos(
          pedidosBanco
            .map(normalizarPedidoBanco)
            .sort((a, b) => b.dataServico.localeCompare(a.dataServico))
        );
      } catch (error) {
        console.error("Erro ao carregar pedidos do Appwrite:", error);
        setPedidos(ler<PedidoData[]>(CHAVE_PEDIDOS, []));
      }

      try {
        if (extintoresBancoDisponivel()) {
          const extintoresBanco = await listarExtintoresNoBanco();
          setExtintores(
            extintoresBanco
              .map(normalizarExtintorBanco)
              .sort((a, b) => a.clienteNome.localeCompare(b.clienteNome))
          );
        } else {
          setExtintores(ler<ExtintorData[]>(CHAVE_EXTINTORES, []));
        }
      } catch (error) {
        console.error("Erro ao carregar extintores do Appwrite:", error);
        setExtintores(ler<ExtintorData[]>(CHAVE_EXTINTORES, []));
      }
    };

    carregarDados();
  }, []);

  useEffect(() => {
    gravar(CHAVE_CLIENTES, clientes);
  }, [clientes]);

  useEffect(() => {
    gravar(CHAVE_PEDIDOS, pedidos);
  }, [pedidos]);

  useEffect(() => {
    gravar(CHAVE_EXTINTORES, extintores);
  }, [extintores]);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(""), 2600);
    return () => clearTimeout(t);
  }, [msg]);

  const itensServico = useMemo(() => {
    if (!item.servico) return [];
    return Object.keys(CATALOGO[item.servico] || {});
  }, [item.servico]);

  const totalItem = useMemo(() => {
    const qtd = Math.max(1, Number(item.qtd || 1));
    const unit = numero(item.unit);
    return qtd * unit;
  }, [item.qtd, item.unit]);

  const totalPedido = useMemo(() => {
    return pedido.itens.reduce((s, i) => s + Number(i.total || 0), 0);
  }, [pedido.itens]);

  const clienteSelecionado = useMemo(() => {
    return clientes.find((c) => c.id === pedido.clienteId);
  }, [clientes, pedido.clienteId]);

  const clientesFiltrados = useMemo(() => {
    const termo = buscaClientes.trim().toLowerCase();
    if (!termo) return clientes;

    return clientes.filter((c) => {
      const base = [
        c.nome,
        c.cidade,
        c.bairro,
        c.endereco,
        c.email,
        formatarDocumento(c),
        formatarWhatsapp(c.whatsapp),
        somenteDigitos(c.whatsapp),
        somenteDigitos(c.cnpj),
        somenteDigitos(c.cpf),
      ]
        .join(" ")
        .toLowerCase();

      return base.includes(termo);
    });
  }, [buscaClientes, clientes]);

  const historicoFiltrado = useMemo(() => {
    const termo = buscaHistorico.trim().toLowerCase();

    return pedidos.filter((p) => {
      const passaStatus =
        filtroStatusHistorico === "Todos" ? true : p.status === filtroStatusHistorico;

      const base = [
        p.clienteNome,
        p.pedido_codigo,
        p.status,
        p.dataServico,
        p.detalhes,
        ...p.itens.map((i) => `${i.servico} ${i.item}`),
      ]
        .join(" ")
        .toLowerCase();

      const passaBusca = termo ? base.includes(termo) : true;

      return passaStatus && passaBusca;
    });
  }, [buscaHistorico, filtroStatusHistorico, pedidos]);

  const extintoresComStatus = useMemo(() => {
    return extintores.map((e) => {
      const status = statusExtintor(e.vencimento);
      const dias = diferencaDias(e.vencimento);
      return {
        ...e,
        status,
        dias,
      };
    });
  }, [extintores]);

  const extintoresFiltrados = useMemo(() => {
    const termo = buscaExtintores.trim().toLowerCase();

    return extintoresComStatus.filter((e) => {
      const base = [
        e.clienteNome,
        e.tipo,
        e.capacidade,
        e.local,
        e.numeroSerie,
        e.vencimento,
        e.observacoes,
      ]
        .join(" ")
        .toLowerCase();

      const passaBusca = termo ? base.includes(termo) : true;
      const passaStatus =
        filtroStatusExtintor === "Todos" ? true : e.status === filtroStatusExtintor;

      return passaBusca && passaStatus;
    });
  }, [extintoresComStatus, buscaExtintores, filtroStatusExtintor]);

  const clienteStatusMap = useMemo(() => {
    const mapa: Record<string, ReturnType<typeof statusGeralCliente>> = {};

    clientes.forEach((clienteAtual) => {
      const extintoresCliente = extintores.filter((ext) => ext.clienteId === clienteAtual.id);
      mapa[clienteAtual.id] = statusGeralCliente(extintoresCliente);
    });

    return mapa;
  }, [clientes, extintores]);

  const extintoresVerdes = useMemo(
    () => extintoresComStatus.filter((e) => e.status === "verde").length,
    [extintoresComStatus]
  );
  const extintoresLaranja = useMemo(
    () => extintoresComStatus.filter((e) => e.status === "laranja").length,
    [extintoresComStatus]
  );
  const extintoresVermelhos = useMemo(
    () => extintoresComStatus.filter((e) => e.status === "vermelho").length,
    [extintoresComStatus]
  );

  const alertasExtintores = useMemo(() => {
    return extintoresComStatus
      .filter((e) => e.status !== "verde")
      .sort((a, b) => {
        const da = a.dias ?? 999999;
        const db = b.dias ?? 999999;
        return da - db;
      })
      .slice(0, 8);
  }, [extintoresComStatus]);

  const totalFaturado = useMemo(
    () => pedidos.reduce((s, p) => s + Number(p.total || 0), 0),
    [pedidos]
  );

  const pedidosEmAndamento = useMemo(
    () => pedidos.filter((p) => p.status === "Em atendimento").length,
    [pedidos]
  );

  const totalHistoricoFiltrado = useMemo(
    () => historicoFiltrado.reduce((s, p) => s + Number(p.total || 0), 0),
    [historicoFiltrado]
  );

  async function recarregarExtintoresDoBanco() {
    if (!extintoresBancoDisponivel()) return false;

    try {
      const extintoresBanco = await listarExtintoresNoBanco();
      setExtintores(
        extintoresBanco
          .map(normalizarExtintorBanco)
          .sort((a, b) => a.clienteNome.localeCompare(b.clienteNome))
      );
      return true;
    } catch (error) {
      console.error("Erro ao recarregar extintores do Appwrite:", error);
      return false;
    }
  }

  function limparFormularioCliente() {
    setCliente(clienteInicial);
    setClienteEditandoId(null);
  }

  function limparPedidoCompleto() {
    setPedido({
      ...pedidoInicial,
      dataServico: hojeISO(),
    });
    setItem(itemInicial);
  }

  function limparExtintorForm() {
    setExtintorForm(extintorInicial);
  }

  function editarCliente(c: ClienteData) {
    setClienteEditandoId(c.id);
    setCliente({
      nome: c.nome || "",
      tipo: c.tipo || "juridica",
      cnpj: c.cnpj || "",
      cpf: c.cpf || "",
      whatsapp: c.whatsapp || "",
      endereco: c.endereco || "",
      numero: c.numero || "",
      bairro: c.bairro || "",
      cidade: c.cidade || "",
      email: c.email || "",
    });
    setAba("cadastro");
  }

  function usarNoPedido(c: ClienteData) {
    setPedido((p) => ({
      ...p,
      clienteId: c.id,
      clienteNome: c.nome,
    }));
    setAba("pedido");
    setMsg("Cliente selecionado no pedido.");
  }

  function duplicarPedido(p: PedidoData) {
    setPedido({
      clienteId: p.clienteId,
      clienteNome: p.clienteNome,
      dataServico: hojeISO(),
      detalhes: p.detalhes || "",
      status: "Em atendimento",
      itens: (p.itens || []).map((i) => ({
        ...i,
        id: idLocal(),
      })),
    });

    setItem(itemInicial);
    setAba("pedido");
    setMsg(`Pedido ${p.pedido_codigo} duplicado para novo lançamento.`);
  }

  async function preencherCnpj() {
    if (cliente.tipo !== "juridica") {
      setMsg("A busca automática funciona apenas para CNPJ.");
      return;
    }

    const cnpjLimpo = somenteDigitos(cliente.cnpj);

    if (cnpjLimpo.length !== 14) {
      setMsg("Digite um CNPJ válido com 14 números.");
      return;
    }

    try {
      setBuscandoCnpj(true);
      setMsg("Buscando CNPJ...");

      const empresa = await buscarCnpjBrasilApi(cnpjLimpo);

      setCliente((c) => ({
        ...c,
        nome: empresa.razao_social || empresa.nome_fantasia || c.nome,
        cnpj: formatarCnpj(empresa.cnpj || c.cnpj),
        endereco: empresa.logradouro || c.endereco,
        numero: empresa.numero || c.numero,
        bairro: empresa.bairro || c.bairro,
        cidade: empresa.municipio || c.cidade,
      }));

      setMsg("CNPJ preenchido automaticamente.");
    } catch (error) {
      console.error("Erro ao consultar CNPJ:", error);
      setMsg("Não foi possível consultar esse CNPJ agora.");
    } finally {
      setBuscandoCnpj(false);
    }
  }

  async function salvarCliente() {
    if (!cliente.nome.trim()) {
      return setMsg("Preencha o nome do cliente.");
    }

    try {
      const clienteParaSalvar: ClienteForm = {
        ...cliente,
        cnpj: somenteDigitos(cliente.cnpj),
        cpf: somenteDigitos(cliente.cpf),
        whatsapp: somenteDigitos(cliente.whatsapp),
      };

      if (clienteEditandoId) {
        await atualizarClienteNoBanco(clienteEditandoId, clienteParaSalvar);
      } else {
        await salvarClienteNoBanco(clienteParaSalvar);
      }

      const clientesBanco = await listarClientesNoBanco();
      setClientes(clientesBanco.map(normalizarClienteBanco));

      limparFormularioCliente();
      setMsg("Cliente salvo no banco.");
      setAba("clientes");
    } catch (error) {
      console.error("Erro ao salvar cliente no Appwrite:", error);
      setMsg("Erro ao salvar cliente no banco.");
    }
  }

  async function salvarExtintor() {
    if (!extintorForm.clienteId) {
      setMsg("Selecione o cliente do extintor.");
      return;
    }
    if (!extintorForm.tipo.trim()) {
      setMsg("Informe o tipo do extintor.");
      return;
    }
    if (!extintorForm.vencimento) {
      setMsg("Informe a data de vencimento.");
      return;
    }

    const clienteAtual = clientes.find((c) => c.id === extintorForm.clienteId);

    if (!clienteAtual) {
      setMsg("Cliente do extintor não encontrado.");
      return;
    }

    const novoExtintor: ExtintorData = {
      id: idLocal(),
      clienteId: extintorForm.clienteId,
      clienteNome: clienteAtual.nome,
      tipo: extintorForm.tipo,
      capacidade: extintorForm.capacidade,
      local: extintorForm.local,
      numeroSerie: extintorForm.numeroSerie,
      vencimento: extintorForm.vencimento,
      observacoes: extintorForm.observacoes,
    };

    try {
      if (extintoresBancoDisponivel()) {
        await salvarOuAtualizarExtintorNoBanco(novoExtintor);
        const atualizouDoBanco = await recarregarExtintoresDoBanco();
        if (!atualizouDoBanco) {
          setExtintores((old) => mesclarExtintores(old, [novoExtintor]));
        }
      } else {
        setExtintores((old) => mesclarExtintores(old, [novoExtintor]));
      }

      limparExtintorForm();
      setMsg(
        extintoresBancoDisponivel()
          ? "Extintor salvo no banco com sucesso."
          : "Extintor cadastrado com sucesso."
      );
    } catch (error) {
      console.error("Erro ao salvar extintor:", error);
      setMsg("Erro ao salvar extintor.");
    }
  }

  async function removerExtintor(id: string) {
    if (PERFIL_ATUAL !== "admin") {
      setMsg("Somente o administrador pode excluir extintores.");
      return;
    }
    if (!window.confirm("Deseja excluir este extintor?")) return;

    try {
      const alvo = extintores.find((e) => e.id === id);

      if (extintoresBancoDisponivel() && alvo?.rowId) {
        await excluirExtintorNoBanco(alvo.rowId);
        const atualizouDoBanco = await recarregarExtintoresDoBanco();
        if (!atualizouDoBanco) {
          setExtintores((old) => old.filter((e) => e.id !== id));
        }
      } else {
        setExtintores((old) => old.filter((e) => e.id !== id));
      }

      setMsg("Extintor excluído.");
    } catch (error) {
      console.error("Erro ao excluir extintor:", error);
      setMsg("Erro ao excluir extintor.");
    }
  }

  function preencherPrecoAutomatico(servico: string, itemNome: string) {
    const valor = CATALOGO[servico]?.[itemNome];
    if (typeof valor === "number") {
      setItem((old) => ({ ...old, unit: String(valor) }));
    }
  }

  function addItem() {
    if (!item.servico || !item.item || !numero(item.unit)) {
      return setMsg("Preencha serviço, item e valor.");
    }

    const novo: PedidoItem = {
      id: idLocal(),
      servico: item.servico,
      item: item.item,
      qtd: Math.max(1, Number(item.qtd || 1)),
      unit: numero(item.unit),
      total: Math.max(1, Number(item.qtd || 1)) * numero(item.unit),
    };

    setPedido((p) => ({ ...p, itens: [...p.itens, novo] }));
    setItem(itemInicial);
    setMsg("Item adicionado.");
  }

  function removerItem(itemId: string) {
    setPedido((p) => ({
      ...p,
      itens: p.itens.filter((i) => i.id !== itemId),
    }));
  }

  async function salvarPedido() {
    if (!pedido.clienteId) {
      return setMsg("Selecione um cliente.");
    }

    if (!pedido.itens.length) {
      return setMsg("Adicione pelo menos um item.");
    }

    try {
      const clienteAtual = clientes.find((c) => c.id === pedido.clienteId);
      const pedidoCodigo = `PEDIDO-${new Date().getFullYear()}-${String(
        pedidos.length + 1
      ).padStart(4, "0")}`;

      const pedidoBase: PedidoData = {
        id: idLocal(),
        pedido_codigo: pedidoCodigo,
        clienteId: pedido.clienteId,
        clienteNome: clienteAtual?.nome || pedido.clienteNome || "",
        dataServico: pedido.dataServico,
        detalhes: pedido.detalhes,
        itens: pedido.itens,
        total: totalPedido,
        status: pedido.status || "Em atendimento",
        extintoresGerados: [],
      };

      const extintoresGerados = gerarExtintoresDoPedido(pedidoBase);
      const pedidoCompleto: PedidoData = {
        ...pedidoBase,
        extintoresGerados,
      };

      await salvarPedidoNoBanco(pedidoCompleto, clienteAtual);

      if (extintoresGerados.length) {
        const payloadExtintores: ExtintorData[] = extintoresGerados.map((ext, index) => ({
          id: `${pedidoCompleto.id}-${index + 1}`,
          clienteId: pedidoCompleto.clienteId,
          clienteNome: pedidoCompleto.clienteNome,
          tipo: ext.tipo,
          capacidade: ext.capacidade,
          local: ext.local,
          numeroSerie: ext.numeroSerie,
          vencimento: ext.vencimento,
          observacoes: ext.observacoes,
        }));

        if (extintoresBancoDisponivel()) {
          await Promise.all(
            payloadExtintores.map((ext) => salvarOuAtualizarExtintorNoBanco(ext))
          );
          const atualizouDoBanco = await recarregarExtintoresDoBanco();
          if (!atualizouDoBanco) {
            setExtintores((old) => mesclarExtintores(old, payloadExtintores));
          }
        } else {
          setExtintores((old) => mesclarExtintores(old, payloadExtintores));
        }
      }

      const pedidosBanco = await listarPedidosNoBanco();
      setPedidos(
        pedidosBanco
          .map(normalizarPedidoBanco)
          .sort((a, b) => b.dataServico.localeCompare(a.dataServico))
      );

      limparPedidoCompleto();
      setMsg(
        extintoresGerados.length
          ? `Pedido salvo no banco e ${extintoresGerados.length} extintor(es) atualizado(s) automaticamente.`
          : "Pedido salvo no banco."
      );
      setAba("historico");
    } catch (error) {
      console.error("Erro ao salvar pedido no Appwrite:", error);
      setMsg("Erro ao salvar pedido no banco.");
    }
  }

  async function alterarStatusPedido(rowId: string | undefined, status: string) {
    if (!rowId) return;
    try {
      await atualizarStatusPedidoNoBanco(rowId, status);
      const pedidosBanco = await listarPedidosNoBanco();
      setPedidos(
        pedidosBanco
          .map(normalizarPedidoBanco)
          .sort((a, b) => b.dataServico.localeCompare(a.dataServico))
      );
      setMsg("Status atualizado.");
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      setMsg("Erro ao atualizar status.");
    }
  }

  async function excluirPedido(rowId: string | undefined) {
    if (PERFIL_ATUAL !== "admin") {
      setMsg("Somente o administrador pode excluir pedidos.");
      return;
    }

    if (!rowId) return;
    if (!window.confirm("Deseja excluir este pedido?")) return;

    try {
      await excluirPedidoNoBanco(rowId);
      const pedidosBanco = await listarPedidosNoBanco();
      setPedidos(
        pedidosBanco
          .map(normalizarPedidoBanco)
          .sort((a, b) => b.dataServico.localeCompare(a.dataServico))
      );
      setMsg("Pedido excluído.");
    } catch (error) {
      console.error("Erro ao excluir pedido:", error);
      setMsg("Erro ao excluir pedido.");
    }
  }

  function gerarPdf(p: PedidoData, salvar = false) {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const clienteAtual = clientes.find((c) => c.id === p.clienteId);
    const extintoresPedido = (p.extintoresGerados || []).filter(Boolean);
    const proximoVencimento = extintoresPedido.length
      ? extintoresPedido
          .map((ext) => ext.vencimento)
          .filter(Boolean)
          .sort()[0]
      : "";

    let y = 14;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(18, 18, 18);
    doc.text("ROTA EXTINTORES", 14, y);
    y += 6;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(70, 70, 70);
    doc.text("MOISES BEZERRA COMERCIO DE EXTINTORES", 14, y);
    y += 5;
    doc.text("JOSE DEDE GODOY, 107 - DOM HELDER CAMARA", 14, y);
    y += 5;
    doc.text("Garanhuns - PE - 55294-828", 14, y);
    y += 5;
    doc.text("E-mail: rotaleee@hotmail.com", 14, y);
    y += 5;
    doc.text("Celular: (87) 99626-2120", 14, y);
    y += 5;
    doc.text("CNPJ: 19.677.414/0001-88", 14, y);
    y += 8;

    doc.setDrawColor(207, 32, 39);
    doc.line(14, y, pageWidth - 14, y);
    y += 8;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(18, 18, 18);
    doc.text(`Pedido Nº: ${p.pedido_codigo}`, 14, y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Data: ${formatarDataBrasil(p.dataServico)}`, pageWidth - 60, y);
    y += 8;

    doc.setFont("helvetica", "bold");
    doc.text("Dados do cliente", 14, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.text(`Razão/Nome: ${p.clienteNome || "-"}`, 14, y);
    y += 5;
    doc.text(`Contato: ${clienteAtual?.nome || p.clienteNome || "-"}`, 14, y);
    y += 5;
    doc.text(`WhatsApp: ${formatarWhatsapp(clienteAtual?.whatsapp || "-")}`, 14, y);
    y += 5;
    doc.text(
      `Endereço: ${clienteAtual?.endereco || "-"}, ${clienteAtual?.numero || "-"}`,
      14,
      y
    );
    y += 5;
    doc.text(
      `Bairro: ${clienteAtual?.bairro || "-"}   Cidade: ${clienteAtual?.cidade || "-"}`,
      14,
      y
    );
    y += 5;
    doc.text(
      `CNPJ/CPF: ${clienteAtual ? formatarDocumento(clienteAtual) : "-"}`,
      14,
      y
    );
    y += 8;

    if (proximoVencimento) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(22, 101, 52);
      doc.text(`Próximo vencimento: ${formatarDataBrasil(proximoVencimento)}`, 14, y);
      y += 8;
      doc.setTextColor(18, 18, 18);
    }

    doc.setFont("helvetica", "bold");
    doc.setFillColor(242, 194, 48);
    doc.rect(14, y, pageWidth - 28, 8, "F");
    doc.setTextColor(18, 18, 18);
    doc.text("Qtd", 16, y + 5.5);
    doc.text("Descrição", 32, y + 5.5);
    doc.text("Preço", pageWidth - 62, y + 5.5);
    doc.text("Total", pageWidth - 28, y + 5.5, { align: "right" });
    y += 10;

    doc.setFont("helvetica", "normal");
    p.itens.forEach((i) => {
      const descricao = `${i.servico} - ${i.item}`;
      doc.text(String(i.qtd), 16, y);
      doc.text(descricao, 32, y);
      doc.text(moeda(i.unit), pageWidth - 62, y);
      doc.text(moeda(i.total), pageWidth - 28, y, { align: "right" });
      y += 7;

      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    });

    if (extintoresPedido.length) {
      y += 4;
      doc.setDrawColor(207, 32, 39);
      doc.line(14, y, pageWidth - 14, y);
      y += 8;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Extintores atualizados automaticamente", 14, y);
      y += 6;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);

      extintoresPedido.forEach((ext, index) => {
        const linha = `${index + 1}. ${ext.tipo}${ext.capacidade ? ` ${ext.capacidade}` : ""} • Série: ${ext.numeroSerie || "-"} • Venc.: ${formatarDataBrasil(ext.vencimento)}`;
        doc.text(linha, 14, y);
        y += 5;

        if (y > 270) {
          doc.addPage();
          y = 20;
        }
      });
    }

    y += 4;
    doc.setDrawColor(207, 32, 39);
    doc.line(14, y, pageWidth - 14, y);
    y += 8;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`Total: ${moeda(p.total)}`, pageWidth - 14, y, { align: "right" });
    y += 10;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Vendedor: Moisés", 14, y);
    y += 5;
    doc.text(`Sit. Pedido: ${p.status}`, 14, y);
    y += 5;
    doc.text(`Cond. Pagto: ${p.detalhes || "-"}`, 14, y);
    y += 8;

    if (p.detalhes) {
      doc.setFont("helvetica", "bold");
      doc.text("OBS.:", 14, y);
      doc.setFont("helvetica", "normal");
      doc.text(p.detalhes, 28, y);
    }

    if (salvar) {
      doc.save(`${p.pedido_codigo}.pdf`);
      return;
    }

    const blobUrl = doc.output("bloburl");
    window.open(blobUrl, "_blank");
  }

  function enviarWhatsAppPedido(p: PedidoData) {
    const clienteAtual = clientes.find((c) => c.id === p.clienteId);
    const numeroZap = whatsappLimpo(clienteAtual?.whatsapp || "");
    if (!numeroZap) return setMsg("Cliente sem WhatsApp cadastrado.");

    const texto = [
      `Olá, segue o resumo do seu pedido ${p.pedido_codigo}:`,
      `Cliente: ${p.clienteNome}`,
      `Data: ${p.dataServico}`,
      ...p.itens.map(
        (i) =>
          `- ${i.servico} / ${i.item} | Qtd: ${i.qtd} | Total: ${moeda(i.total)}`
      ),
      `Total: ${moeda(p.total)}`,
      p.detalhes ? `Observações: ${p.detalhes}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    window.open(
      `https://wa.me/55${numeroZap}?text=${encodeURIComponent(texto)}`,
      "_blank"
    );
  }

  function enviarWhatsAppExtintor(ext: ExtintorData) {
    const cliente = clientes.find((c) => c.id === ext.clienteId);
    const numero = whatsappLimpo(cliente?.whatsapp || "");
    if (!numero) {
      setMsg("Cliente sem WhatsApp cadastrado.");
      return;
    }

    const texto = [
      `Olá, aviso importante da Rota Extintores.`,
      `Cliente: ${ext.clienteNome}`,
      `Extintor: ${ext.tipo} ${ext.capacidade ? `- ${ext.capacidade}` : ""}`,
      ext.local ? `Local: ${ext.local}` : "",
      `Vencimento: ${ext.vencimento}`,
      `Status: ${textoStatusExtintor(ext.vencimento)}`,
      `É muito importante manter os extintores dentro do prazo para garantir a segurança do local.`,
      `Fale com a Rota Extintores para regularização.`,
    ]
      .filter(Boolean)
      .join("\n");

    window.open(
      `https://wa.me/55${numero}?text=${encodeURIComponent(texto)}`,
      "_blank"
    );
  }

  function enviarEmailExtintor(ext: ExtintorData) {
    const cliente = clientes.find((c) => c.id === ext.clienteId);
    const email = cliente?.email || "";
    if (!email) {
      setMsg("Cliente sem e-mail cadastrado.");
      return;
    }

    const assunto = `Alerta de vencimento de extintor - ${ext.clienteNome}`;
    const corpo = [
      `Olá,`,
      ``,
      `Aviso importante da Rota Extintores.`,
      `Cliente: ${ext.clienteNome}`,
      `Extintor: ${ext.tipo} ${ext.capacidade ? `- ${ext.capacidade}` : ""}`,
      ext.local ? `Local: ${ext.local}` : "",
      `Vencimento: ${ext.vencimento}`,
      `Status: ${textoStatusExtintor(ext.vencimento)}`,
      ``,
      `É muito importante manter os extintores dentro do prazo para garantir a segurança do local.`,
      `Entre em contato para regularização.`,
    ].join("\n");

    window.open(
      `mailto:${email}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(
        corpo
      )}`
    );
  }

  function renderDashboard() {
    return (
      <div>
        <div
          style={{
            ...ui.topGrid,
            gridTemplateColumns: isMobile ? "1fr" : "1.3fr 0.7fr",
          }}
        >
          <div style={ui.darkCard}>
            <div style={ui.darkBadge}>ROTA EXTINTORES • GESTÃO DE CAMPO</div>
            <h2 style={ui.darkTitle}>Sistema comercial e operacional</h2>
            <div style={ui.darkText}>
              Controle clientes, pedidos, histórico, extintores e alertas de
              vencimento em um só lugar. O sistema agora destaca extintores em dia,
              próximos do vencimento e vencidos.
            </div>
          </div>

          <div style={ui.actionsCard}>
            <div style={ui.actionsTitle}>Ações rápidas</div>
            <div style={ui.actionsText}>
              Cadastre clientes, abra pedidos, cadastre extintores e acompanhe os
              alertas de vencimento com semáforo visual.
            </div>

            <button
              type="button"
              style={{ ...getButtonStyle("primary"), width: "100%", marginBottom: 10 }}
              onClick={() => setAba("pedido")}
            >
              + Novo pedido
            </button>

            <button
              type="button"
              style={{ ...getButtonStyle("accent"), width: "100%", marginBottom: 10 }}
              onClick={() => setAba("extintores")}
            >
              + Cadastrar extintor
            </button>

            <button
              type="button"
              style={{ ...getButtonStyle("ghost"), width: "100%" }}
              onClick={() => setAba("historico")}
            >
              Ver histórico
            </button>
          </div>
        </div>

        <div style={ui.statGrid}>
          <div style={ui.statCard}>
            <div style={ui.statCardBar} />
            <div style={ui.statIcon}>👥</div>
            <div style={ui.statLabel}>Clientes cadastrados</div>
            <div style={ui.statValue}>{clientes.length}</div>
            <div style={ui.statHelp}>Base comercial ativa.</div>
          </div>

          <div style={ui.statCard}>
            <div style={ui.statCardBar} />
            <div style={ui.statIcon}>📄</div>
            <div style={ui.statLabel}>Pedidos registrados</div>
            <div style={ui.statValue}>{pedidos.length}</div>
            <div style={ui.statHelp}>Histórico pronto para consulta e PDF.</div>
          </div>

          <div style={ui.statCard}>
            <div style={ui.statCardBar} />
            <div style={ui.statIcon}>🟢</div>
            <div style={ui.statLabel}>Extintores em dia</div>
            <div style={ui.statValue}>{extintoresVerdes}</div>
            <div style={ui.statHelp}>Sem risco imediato.</div>
          </div>

          <div style={ui.statCard}>
            <div style={ui.statCardBar} />
            <div style={ui.statIcon}>🟠</div>
            <div style={ui.statLabel}>Vencem em até 30 dias</div>
            <div style={ui.statValue}>{extintoresLaranja}</div>
            <div style={ui.statHelp}>Atenção para renovar logo.</div>
          </div>

          <div style={ui.statCard}>
            <div style={ui.statCardBar} />
            <div style={ui.statIcon}>🔴</div>
            <div style={ui.statLabel}>Extintores vencidos</div>
            <div style={ui.statValue}>{extintoresVermelhos}</div>
            <div style={ui.statHelp}>Alerta crítico de segurança.</div>
          </div>

          <div style={ui.statCard}>
            <div style={ui.statCardBar} />
            <div style={ui.statIcon}>💰</div>
            <div style={ui.statLabel}>Faturado acumulado</div>
            <div style={{ ...ui.statValue, fontSize: isMobile ? 28 : 34 }}>
              {moeda(totalFaturado)}
            </div>
            <div style={ui.statHelp}>Soma dos pedidos já registrados.</div>
          </div>
        </div>

        <div
          style={{
            ...ui.softGrid2,
            marginTop: 16,
            gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
          }}
        >
          <div style={ui.softCard}>
            <div style={ui.smallTitle}>Situação atual</div>
            <div style={ui.smallText}>
              Agora o app monitora extintores por cliente e mostra semáforo visual:
              verde para em dia, laranja para até 30 dias e vermelho para vencidos.
            </div>
          </div>

          <div style={ui.softCard}>
            <div style={ui.smallTitle}>Blindagem operacional</div>
            <div style={ui.smallText}>
              Vendedor não exclui pedido e não edita pedido salvo. O histórico fica
              protegido e os alertas de extintores ficam bem visíveis.
            </div>
          </div>
        </div>

        <div style={{ ...ui.softCard, marginTop: 16 }}>
          <div style={ui.smallTitle}>Alertas mais urgentes</div>

          {!alertasExtintores.length ? (
            <div style={ui.smallText}>Nenhum alerta crítico no momento.</div>
          ) : (
            <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
              {alertasExtintores.map((ext) => {
                const cor = corStatusExtintor(ext.status);
                return (
                  <div
                    key={ext.id}
                    style={{
                      background: cor.bg,
                      border: `1px solid ${cor.border}`,
                      borderRadius: 16,
                      padding: 14,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 900, color: theme.black }}>
                          {ext.clienteNome}
                        </div>
                        <div style={{ color: theme.text, marginTop: 4 }}>
                          {ext.tipo} {ext.capacidade ? `• ${ext.capacidade}` : ""}
                          {ext.local ? ` • ${ext.local}` : ""}
                        </div>
                        <div style={{ color: cor.text, marginTop: 6, fontWeight: 800 }}>
                          {textoStatusExtintor(ext.vencimento)}
                        </div>
                      </div>

                      <div
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 999,
                          background: cor.dot,
                          boxShadow: `0 0 0 8px ${cor.bg}`,
                          border: "1px solid rgba(0,0,0,0.06)",
                          flexShrink: 0,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderCadastro() {
    return (
      <div>
        <BlocoTitulo
          eyebrow="CADASTRO COMERCIAL"
          titulo={clienteEditandoId ? "Atualizar cliente" : "Cadastro de cliente"}
          acao={
            <button
              type="button"
              onClick={limparFormularioCliente}
              style={getButtonStyle("ghost")}
            >
              Limpar formulário
            </button>
          }
        />

        <div style={{ ...ui.softCard, marginBottom: 18 }}>
          <div style={{ ...ui.smallTitle, marginBottom: 12 }}>Tipo de cadastro</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setCliente((c) => ({ ...c, tipo: "juridica" }))}
              style={
                cliente.tipo === "juridica"
                  ? getButtonStyle("secondary")
                  : getButtonStyle("ghost")
              }
            >
              Pessoa Jurídica
            </button>

            <button
              type="button"
              onClick={() => setCliente((c) => ({ ...c, tipo: "fisica" }))}
              style={
                cliente.tipo === "fisica"
                  ? getButtonStyle("secondary")
                  : getButtonStyle("ghost")
              }
            >
              Pessoa Física
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          <input
            style={ui.input}
            placeholder="Nome do cliente ou empresa"
            value={cliente.nome}
            onChange={(e) => setCliente((c) => ({ ...c, nome: e.target.value }))}
          />

          <div
            style={{
              ...ui.grid2,
              gridTemplateColumns: isMobile ? "1fr" : "1fr auto",
            }}
          >
            <input
              style={ui.input}
              placeholder={cliente.tipo === "juridica" ? "CNPJ" : "CPF"}
              value={formatarDocumentoBruto(
                cliente.tipo,
                cliente.tipo === "juridica" ? cliente.cnpj : cliente.cpf
              )}
              onChange={(e) =>
                cliente.tipo === "juridica"
                  ? setCliente((c) => ({
                      ...c,
                      cnpj: formatarCnpj(e.target.value),
                    }))
                  : setCliente((c) => ({
                      ...c,
                      cpf: formatarCpf(e.target.value),
                    }))
              }
            />

            <button
              type="button"
              onClick={preencherCnpj}
              disabled={buscandoCnpj || cliente.tipo !== "juridica"}
              style={{
                ...getButtonStyle("accent"),
                minWidth: isMobile ? "100%" : 170,
                opacity: buscandoCnpj || cliente.tipo !== "juridica" ? 0.7 : 1,
                cursor:
                  buscandoCnpj || cliente.tipo !== "juridica"
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              {buscandoCnpj ? "Buscando..." : "Buscar CNPJ"}
            </button>
          </div>

          <div
            style={{
              ...ui.grid2,
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
            }}
          >
            <input
              style={ui.input}
              placeholder="WhatsApp"
              value={formatarWhatsapp(cliente.whatsapp)}
              onChange={(e) =>
                setCliente((c) => ({
                  ...c,
                  whatsapp: formatarWhatsapp(e.target.value),
                }))
              }
            />

            <input
              style={ui.input}
              placeholder="E-mail do cliente"
              value={cliente.email || ""}
              onChange={(e) => setCliente((c) => ({ ...c, email: e.target.value }))}
            />
          </div>

          <div
            style={{
              ...ui.grid2,
              gridTemplateColumns: isMobile ? "1fr" : "1fr 180px",
            }}
          >
            <input
              style={ui.input}
              placeholder="Rua / Endereço"
              value={cliente.endereco}
              onChange={(e) => setCliente((c) => ({ ...c, endereco: e.target.value }))}
            />
            <input
              style={ui.input}
              placeholder="Número"
              value={cliente.numero}
              onChange={(e) => setCliente((c) => ({ ...c, numero: e.target.value }))}
            />
          </div>

          <div
            style={{
              ...ui.grid2,
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
            }}
          >
            <input
              style={ui.input}
              placeholder="Bairro"
              value={cliente.bairro}
              onChange={(e) => setCliente((c) => ({ ...c, bairro: e.target.value }))}
            />
            <input
              style={ui.input}
              placeholder="Cidade"
              value={cliente.cidade}
              onChange={(e) => setCliente((c) => ({ ...c, cidade: e.target.value }))}
            />
          </div>

          <div style={ui.rowWrap}>
            <button
              type="button"
              onClick={limparFormularioCliente}
              style={getButtonStyle("ghost")}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={salvarCliente}
              style={getButtonStyle("primary")}
            >
              {clienteEditandoId ? "Atualizar cliente" : "Salvar cliente"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderClientes() {
    return (
      <div>
        <BlocoTitulo
          eyebrow="BASE DE CLIENTES"
          titulo="Clientes cadastrados"
          acao={
            <button
              type="button"
              onClick={() => setAba("cadastro")}
              style={getButtonStyle("primary")}
            >
              + Novo cliente
            </button>
          }
        />

        <div
          style={{
            ...ui.toolbar,
            gridTemplateColumns: isMobile ? "1fr" : "1fr auto",
          }}
        >
          <input
            style={ui.input}
            placeholder="Buscar por nome, CNPJ, WhatsApp, cidade, bairro ou endereço"
            value={buscaClientes}
            onChange={(e) => setBuscaClientes(e.target.value)}
          />

          <div
            style={{
              ...ui.softCard,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 52,
              padding: "0 16px",
              fontWeight: 800,
            }}
          >
            {clientesFiltrados.length} cliente(s)
          </div>
        </div>

        {!clientesFiltrados.length ? (
          <div style={ui.softCard}>Nenhum cliente encontrado.</div>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {clientesFiltrados.map((c) => {
              const extintoresCliente = extintoresComStatus.filter((ext) => ext.clienteId === c.id);
              const statusCliente = clienteStatusMap[c.id] || statusGeralCliente([]);
              const proximoVencimentoCliente = [...extintoresCliente]
                .filter((ext) => ext.vencimento)
                .sort((a, b) => a.vencimento.localeCompare(b.vencimento))[0];
              const resumoCliente = {
                verdes: extintoresCliente.filter((ext) => ext.status === "verde").length,
                laranjas: extintoresCliente.filter((ext) => ext.status === "laranja").length,
                vermelhos: extintoresCliente.filter((ext) => ext.status === "vermelho").length,
              };

              return (
                <div
                  key={c.id}
                  style={{
                    ...ui.clientCard,
                    borderColor: statusCliente.cor.border,
                    boxShadow:
                      statusCliente.status === "vermelho"
                        ? "0 0 0 2px rgba(239,68,68,0.10), 0 12px 24px rgba(239,68,68,0.12)"
                        : statusCliente.status === "laranja"
                        ? "0 0 0 2px rgba(245,158,11,0.10), 0 12px 24px rgba(245,158,11,0.10)"
                        : statusCliente.status === "verde"
                        ? "0 0 0 2px rgba(34,197,94,0.10), 0 12px 24px rgba(34,197,94,0.10)"
                        : theme.shadowSoft,
                  }}
                >
                  <div
                    style={{
                      ...ui.clientCardBar,
                      background:
                        statusCliente.status === "vermelho"
                          ? "linear-gradient(180deg, #ef4444 0%, #b42318 100%)"
                          : statusCliente.status === "laranja"
                          ? "linear-gradient(180deg, #f59e0b 0%, #8a5a00 100%)"
                          : statusCliente.status === "verde"
                          ? "linear-gradient(180deg, #22c55e 0%, #167a3d 100%)"
                          : "linear-gradient(180deg, #cbd5e1 0%, #94a3b8 100%)",
                    }}
                  />

                  <div
                    style={{
                      ...ui.clientHeader,
                      paddingLeft: 8,
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ display: "flex", gap: 14, flex: 1, minWidth: 240 }}>
                      <div style={ui.avatar}>{iniciaisNome(c.nome)}</div>

                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontSize: isMobile ? 21 : 20,
                            fontWeight: 900,
                            color: theme.black,
                            lineHeight: 1.2,
                          }}
                        >
                          {c.nome}
                        </div>

                        <div
                          style={{
                            color: theme.textSoft,
                            marginTop: 8,
                            lineHeight: 1.7,
                            wordBreak: "break-word",
                          }}
                        >
                          {[formatarDocumento(c), formatarWhatsapp(c.whatsapp), c.cidade]
                            .filter(Boolean)
                            .join(" • ")}
                        </div>

                        {(c.endereco || c.numero || c.bairro) && (
                          <div
                            style={{
                              color: theme.textMuted,
                              marginTop: 6,
                              fontSize: 13,
                              lineHeight: 1.6,
                            }}
                          >
                            {[c.endereco, c.numero, c.bairro].filter(Boolean).join(", ")}
                          </div>
                        )}

                        {c.email ? (
                          <div
                            style={{
                              color: theme.textMuted,
                              marginTop: 4,
                              fontSize: 13,
                            }}
                          >
                            {c.email}
                          </div>
                        ) : null}

                        <div
                          style={{
                            marginTop: 10,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            borderRadius: 999,
                            padding: "8px 12px",
                            background: statusCliente.cor.bg,
                            color: statusCliente.cor.text,
                            border: `1px solid ${statusCliente.cor.border}`,
                            fontWeight: 800,
                            fontSize: 13,
                          }}
                        >
                          <span
                            style={{
                              width: 12,
                              height: 12,
                              borderRadius: 999,
                              background: statusCliente.cor.dot,
                              display: "inline-block",
                              boxShadow: `0 0 12px ${statusCliente.cor.dot}`,
                            }}
                          />
                          {statusCliente.label}
                        </div>

                        <div style={{ marginTop: 8, color: theme.textMuted, fontSize: 13 }}>
                          {extintoresCliente.length} extintor(es) monitorado(s)
                        </div>

                        <div
                          style={{
                            marginTop: 10,
                            display: "grid",
                            gap: 8,
                            gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))",
                          }}
                        >
                          <div
                            style={{
                              background: "#f8fafc",
                              border: `1px solid ${theme.border}`,
                              borderRadius: 14,
                              padding: "10px 12px",
                              fontSize: 12,
                              color: theme.textSoft,
                            }}
                          >
                            <div style={{ fontWeight: 800, color: theme.black, marginBottom: 4 }}>
                              Próximo vencimento
                            </div>
                            <div>
                              {proximoVencimentoCliente
                                ? `${formatarDataBrasil(proximoVencimentoCliente.vencimento)} • ${textoStatusExtintor(
                                    proximoVencimentoCliente.vencimento
                                  )}`
                                : "Sem vencimento cadastrado"}
                            </div>
                          </div>

                          <div
                            style={{
                              background: "#f8fafc",
                              border: `1px solid ${theme.border}`,
                              borderRadius: 14,
                              padding: "10px 12px",
                              fontSize: 12,
                              color: theme.textSoft,
                            }}
                          >
                            <div style={{ fontWeight: 800, color: theme.black, marginBottom: 4 }}>
                              Semáforo do cliente
                            </div>
                            <div>
                              🟢 {resumoCliente.verdes} • 🟡 {resumoCliente.laranjas} • 🔴 {resumoCliente.vermelhos}
                            </div>
                          </div>

                          <div
                            style={{
                              background: extintoresBancoDisponivel() ? "#eff6ff" : "#fff7ed",
                              border: `1px solid ${extintoresBancoDisponivel() ? "#bfdbfe" : "#fed7aa"}`,
                              borderRadius: 14,
                              padding: "10px 12px",
                              fontSize: 12,
                              color: theme.textSoft,
                            }}
                          >
                            <div style={{ fontWeight: 800, color: theme.black, marginBottom: 4 }}>
                              Origem dos dados
                            </div>
                            <div>
                              {extintoresBancoDisponivel()
                                ? "Extintores salvos no banco"
                                : "Extintores em backup local"}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div style={statusBadge(c.tipo === "fisica" ? "Concluído" : "Entregue")}>
                      {c.tipo === "fisica" ? "Pessoa Física" : "Pessoa Jurídica"}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      marginTop: 18,
                      flexWrap: "wrap",
                      paddingLeft: 8,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => editarCliente(c)}
                      style={getButtonStyle("ghost")}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => usarNoPedido(c)}
                      style={getButtonStyle("secondary")}
                    >
                      Usar no pedido
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  function renderPedido() {
    return (
      <div>
        <BlocoTitulo
          eyebrow="ATENDIMENTO / ORÇAMENTO"
          titulo="Novo pedido"
          acao={<div style={statusBadge(pedido.status)}>{pedido.status || "Em atendimento"}</div>}
        />

        <div style={{ display: "grid", gap: 14 }}>
          <select
            style={ui.select}
            value={pedido.clienteId}
            onChange={(e) => {
              const id = e.target.value;
              const cli = clientes.find((c) => c.id === id);
              setPedido((p) => ({
                ...p,
                clienteId: id,
                clienteNome: cli?.nome || "",
              }));
            }}
          >
            <option value="">Selecione o cliente</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>

          {clienteSelecionado ? (
            <div style={ui.softCard}>
              <div style={ui.smallTitle}>Cliente selecionado</div>
              <div style={ui.smallText}>
                {clienteSelecionado.nome}
                {clienteSelecionado.whatsapp
                  ? ` • ${formatarWhatsapp(clienteSelecionado.whatsapp)}`
                  : ""}
                {clienteSelecionado.cidade ? ` • ${clienteSelecionado.cidade}` : ""}
              </div>
            </div>
          ) : null}

          <div
            style={{
              ...ui.grid2,
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
            }}
          >
            <input
              style={ui.input}
              type="date"
              value={pedido.dataServico}
              onChange={(e) => setPedido((p) => ({ ...p, dataServico: e.target.value }))}
            />

            <select
              style={ui.select}
              value={pedido.status}
              onChange={(e) => setPedido((p) => ({ ...p, status: e.target.value }))}
            >
              <option>Em atendimento</option>
              <option>Concluído</option>
              <option>Entregue</option>
              <option>Cancelado</option>
            </select>
          </div>

          <textarea
            style={ui.textarea}
            placeholder="Observações do pedido"
            value={pedido.detalhes}
            onChange={(e) => setPedido((p) => ({ ...p, detalhes: e.target.value }))}
          />

          <div style={{ ...ui.softCard, marginTop: 4 }}>
            <div style={{ ...ui.smallTitle, marginBottom: 14 }}>Adicionar item</div>

            <div
              style={{
                ...ui.grid2,
                gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
              }}
            >
              <select
                style={ui.select}
                value={item.servico}
                onChange={(e) => {
                  setItem((old) => ({ ...old, servico: e.target.value, item: "", unit: "" }));
                }}
              >
                <option value="">Selecione o serviço</option>
                {Object.keys(CATALOGO).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              <select
                style={ui.select}
                value={item.item}
                onChange={(e) => {
                  const itemNome = e.target.value;
                  setItem((old) => ({ ...old, item: itemNome }));
                  preencherPrecoAutomatico(item.servico, itemNome);
                }}
              >
                <option value="">Escolha o item</option>
                {itensServico.map((nome) => (
                  <option key={nome} value={nome}>
                    {nome}
                  </option>
                ))}
              </select>
            </div>

            <div
              style={{
                ...ui.grid2,
                marginTop: 14,
                gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
              }}
            >
              <input
                style={ui.input}
                type="number"
                min={1}
                placeholder="Quantidade"
                value={item.qtd}
                onChange={(e) =>
                  setItem((old) => ({ ...old, qtd: Math.max(1, Number(e.target.value || 1)) }))
                }
              />
              <input
                style={ui.input}
                placeholder="Valor unitário"
                value={item.unit}
                onChange={(e) => setItem((old) => ({ ...old, unit: e.target.value }))}
              />
            </div>

            <div style={{ ...ui.softCard, marginTop: 14, padding: 14 }}>
              <div style={{ color: theme.textSoft, fontWeight: 800, marginBottom: 6 }}>
                Total do item
              </div>
              <div style={{ color: theme.black, fontWeight: 900, fontSize: 28 }}>
                {moeda(totalItem)}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
              <button type="button" onClick={addItem} style={getButtonStyle("accent")}>
                Adicionar item
              </button>
            </div>
          </div>

          <div>
            <div style={{ ...ui.smallTitle, marginBottom: 14 }}>Itens do pedido</div>

            {!pedido.itens.length ? (
              <div style={ui.softCard}>Nenhum item adicionado.</div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {pedido.itens.map((i) => (
                  <div key={i.id} style={ui.itemCard}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 220 }}>
                        <div style={{ fontWeight: 900, color: theme.black, fontSize: 18 }}>
                          {i.servico}
                        </div>
                        <div style={{ color: theme.text, marginTop: 6 }}>{i.item}</div>
                        <div style={{ color: theme.textSoft, marginTop: 8, lineHeight: 1.6 }}>
                          Qtd: {i.qtd} • Unit: {moeda(i.unit)} • Total: {moeda(i.total)}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removerItem(i.id)}
                        style={getButtonStyle("danger")}
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={ui.totalCard}>
            <div style={ui.totalMini}>Total do pedido</div>
            <div style={ui.totalValue}>{moeda(totalPedido)}</div>
          </div>

          <div
            style={{
              ...ui.softCard,
              background: "#fff8e5",
              borderColor: "#f3dda0",
              color: "#8a5a00",
            }}
          >
            Ao salvar o pedido, o sistema atualiza automaticamente os extintores do cliente e já calcula o próximo vencimento para 1 ano após a data do serviço.
          </div>

          <div style={ui.rowWrap}>
            <button
              type="button"
              onClick={limparPedidoCompleto}
              style={getButtonStyle("ghost")}
            >
              Limpar pedido
            </button>

            <button
              type="button"
              onClick={salvarPedido}
              style={getButtonStyle("primary")}
            >
              Salvar pedido
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderHistorico() {
    return (
      <div>
        <BlocoTitulo eyebrow="CONSULTA E ACOMPANHAMENTO" titulo="Histórico de pedidos" />

        <div
          style={{
            ...ui.toolbar,
            gridTemplateColumns: isMobile ? "1fr" : "1.1fr 0.6fr",
          }}
        >
          <input
            style={ui.input}
            placeholder="Buscar pedido, cliente, status, data, observação ou item"
            value={buscaHistorico}
            onChange={(e) => setBuscaHistorico(e.target.value)}
          />

          <select
            style={ui.select}
            value={filtroStatusHistorico}
            onChange={(e) => setFiltroStatusHistorico(e.target.value)}
          >
            <option>Todos</option>
            <option>Em atendimento</option>
            <option>Concluído</option>
            <option>Entregue</option>
            <option>Cancelado</option>
          </select>
        </div>

        <div
          style={{
            ...ui.softGrid2,
            gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
            marginBottom: 16,
          }}
        >
          <div style={ui.softCard}>
            <div style={ui.smallTitle}>Resultado da busca</div>
            <div style={ui.smallText}>
              {historicoFiltrado.length} pedido(s) encontrado(s).
            </div>
          </div>

          <div style={ui.softCard}>
            <div style={ui.smallTitle}>Total filtrado</div>
            <div style={ui.smallText}>{moeda(totalHistoricoFiltrado)}</div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 14, marginTop: 16 }}>
          {!historicoFiltrado.length ? (
            <div style={ui.softCard}>Nenhum pedido encontrado.</div>
          ) : (
            historicoFiltrado.map((p) => (
              <div key={p.rowId || p.id} style={ui.orderCard}>
                <div style={ui.orderBar} />

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 14,
                    flexWrap: "wrap",
                    marginTop: 6,
                  }}
                >
                  <div style={{ minWidth: 220 }}>
                    <div
                      style={{
                        fontSize: isMobile ? 22 : 21,
                        fontWeight: 900,
                        color: theme.black,
                      }}
                    >
                      {p.clienteNome}
                    </div>
                    <div style={{ color: theme.text, marginTop: 8, fontWeight: 700 }}>
                      {p.pedido_codigo}
                    </div>
                    <div style={{ color: theme.textSoft, marginTop: 6 }}>
                      {p.dataServico}
                    </div>
                  </div>

                  <div style={statusBadge(p.status)}>{p.status}</div>
                </div>

                <div
                  style={{
                    marginTop: 14,
                    color: theme.text,
                    lineHeight: 1.75,
                    background: theme.cardAlt,
                    border: `1px solid ${theme.border}`,
                    borderRadius: 16,
                    padding: 14,
                  }}
                >
                  {p.itens.map((i) => (
                    <div key={i.id}>
                      {i.servico} • {i.item} • Qtd: {i.qtd} • Total: {moeda(i.total)}
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    marginTop: 14,
                    fontSize: isMobile ? 24 : 26,
                    fontWeight: 900,
                    color: theme.black,
                  }}
                >
                  Total do pedido: {moeda(p.total)}
                </div>

                {p.detalhes ? (
                  <div style={{ ...ui.softCard, marginTop: 14, padding: 14 }}>
                    <div style={{ fontWeight: 900, color: theme.black, marginBottom: 6 }}>
                      Observações
                    </div>
                    <div style={{ color: theme.text }}>{p.detalhes}</div>
                  </div>
                ) : null}

                <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
                  <button type="button" onClick={() => gerarPdf(p, false)} style={getButtonStyle("ghost")}>
                    Visualizar PDF
                  </button>

                  <button type="button" onClick={() => gerarPdf(p, true)} style={getButtonStyle("accent")}>
                    Baixar PDF
                  </button>

                  <button
                    type="button"
                    onClick={() => enviarWhatsAppPedido(p)}
                    style={getButtonStyle("secondary")}
                  >
                    Enviar WhatsApp
                  </button>

                  <button
                    type="button"
                    onClick={() => duplicarPedido(p)}
                    style={getButtonStyle("ghost")}
                  >
                    Duplicar pedido
                  </button>
                </div>

                <div
                  style={{
                    ...ui.grid2,
                    marginTop: 14,
                    gridTemplateColumns:
                      isMobile
                        ? "1fr"
                        : PERFIL_ATUAL === "admin"
                        ? "1fr 220px"
                        : "1fr",
                  }}
                >
                  <select
                    style={ui.select}
                    value={p.status}
                    onChange={(e) => alterarStatusPedido(p.rowId, e.target.value)}
                  >
                    <option>Em atendimento</option>
                    <option>Concluído</option>
                    <option>Entregue</option>
                    <option>Cancelado</option>
                  </select>

                  {PERFIL_ATUAL === "admin" ? (
                    <button
                      type="button"
                      onClick={() => excluirPedido(p.rowId)}
                      style={getButtonStyle("danger")}
                    >
                      Excluir pedido
                    </button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  function renderExtintores() {
    return (
      <div>
        <BlocoTitulo
          eyebrow="CONTROLE DE VENCIMENTO"
          titulo="Extintores dos clientes"
          acao={
            <div
              style={{
                ...ui.softCard,
                padding: "10px 14px",
                fontWeight: 800,
              }}
            >
              {extintoresFiltrados.length} extintor(es)
            </div>
          }
        />

        <div
          style={{
            ...ui.softGrid2,
            gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
            marginBottom: 16,
          }}
        >
          <div
            style={{
              ...ui.softCard,
              background: "#ebfff1",
              borderColor: "#b7e4c7",
            }}
          >
            <div style={{ ...ui.smallTitle, color: "#167a3d" }}>🟢 Em dia</div>
            <div style={{ fontSize: 30, fontWeight: 900 }}>{extintoresVerdes}</div>
          </div>

          <div
            style={{
              ...ui.softCard,
              background: "#fff8e5",
              borderColor: "#f3dda0",
            }}
          >
            <div style={{ ...ui.smallTitle, color: "#8a5a00" }}>🟠 Até 30 dias</div>
            <div style={{ fontSize: 30, fontWeight: 900 }}>{extintoresLaranja}</div>
          </div>

          <div
            style={{
              ...ui.softCard,
              background: "#fff0f0",
              borderColor: "#f4cccc",
            }}
          >
            <div style={{ ...ui.smallTitle, color: "#b42318" }}>🔴 Vencidos</div>
            <div style={{ fontSize: 30, fontWeight: 900 }}>{extintoresVermelhos}</div>
          </div>
        </div>

        <div style={{ ...ui.softCard, marginBottom: 18 }}>
          <div style={{ ...ui.smallTitle, marginBottom: 14 }}>Cadastrar extintor</div>

          <div style={{ display: "grid", gap: 14 }}>
            <select
              style={ui.select}
              value={extintorForm.clienteId}
              onChange={(e) =>
                setExtintorForm((old) => ({ ...old, clienteId: e.target.value }))
              }
            >
              <option value="">Selecione o cliente</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>

            <div
              style={{
                ...ui.grid2,
                gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
              }}
            >
              <input
                style={ui.input}
                placeholder="Tipo do extintor (ABC, BC, CO2, AP...)"
                value={extintorForm.tipo}
                onChange={(e) =>
                  setExtintorForm((old) => ({ ...old, tipo: e.target.value }))
                }
              />

              <input
                style={ui.input}
                placeholder="Capacidade (4kg, 6kg, 10L...)"
                value={extintorForm.capacidade}
                onChange={(e) =>
                  setExtintorForm((old) => ({ ...old, capacidade: e.target.value }))
                }
              />
            </div>

            <div
              style={{
                ...ui.grid2,
                gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
              }}
            >
              <input
                style={ui.input}
                placeholder="Local do extintor"
                value={extintorForm.local}
                onChange={(e) =>
                  setExtintorForm((old) => ({ ...old, local: e.target.value }))
                }
              />

              <input
                style={ui.input}
                placeholder="Número de série / patrimônio"
                value={extintorForm.numeroSerie}
                onChange={(e) =>
                  setExtintorForm((old) => ({ ...old, numeroSerie: e.target.value }))
                }
              />
            </div>

            <input
              style={ui.input}
              type="date"
              value={extintorForm.vencimento}
              onChange={(e) =>
                setExtintorForm((old) => ({ ...old, vencimento: e.target.value }))
              }
            />

            <textarea
              style={ui.textarea}
              placeholder="Observações"
              value={extintorForm.observacoes}
              onChange={(e) =>
                setExtintorForm((old) => ({ ...old, observacoes: e.target.value }))
              }
            />

            <div style={ui.rowWrap}>
              <button
                type="button"
                onClick={limparExtintorForm}
                style={getButtonStyle("ghost")}
              >
                Limpar
              </button>
              <button
                type="button"
                onClick={salvarExtintor}
                style={getButtonStyle("primary")}
              >
                Salvar extintor
              </button>
            </div>
          </div>
        </div>

        <div
          style={{
            ...ui.toolbar,
            gridTemplateColumns: isMobile ? "1fr" : "1fr 220px",
          }}
        >
          <input
            style={ui.input}
            placeholder="Buscar por cliente, tipo, local, série ou vencimento"
            value={buscaExtintores}
            onChange={(e) => setBuscaExtintores(e.target.value)}
          />

          <select
            style={ui.select}
            value={filtroStatusExtintor}
            onChange={(e) => setFiltroStatusExtintor(e.target.value)}
          >
            <option>Todos</option>
            <option value="verde">verde</option>
            <option value="laranja">laranja</option>
            <option value="vermelho">vermelho</option>
          </select>
        </div>

        {!extintoresFiltrados.length ? (
          <div style={ui.softCard}>Nenhum extintor encontrado.</div>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {extintoresFiltrados.map((ext) => {
              const cor = corStatusExtintor(ext.status);

              return (
                <div
                  key={ext.id}
                  style={{
                    ...ui.itemCard,
                    borderColor: cor.border,
                    background: cor.bg,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 16,
                      flexWrap: "wrap",
                      alignItems: "flex-start",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 240 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          flexWrap: "wrap",
                        }}
                      >
                        <div
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: 999,
                            background: cor.dot,
                            border: "1px solid rgba(0,0,0,0.08)",
                          }}
                        />
                        <div
                          style={{
                            fontSize: 22,
                            fontWeight: 900,
                            color: theme.black,
                          }}
                        >
                          {ext.clienteNome}
                        </div>
                      </div>

                      <div style={{ marginTop: 10, color: theme.text, lineHeight: 1.7 }}>
                        {ext.tipo}
                        {ext.capacidade ? ` • ${ext.capacidade}` : ""}
                        {ext.local ? ` • ${ext.local}` : ""}
                        {ext.numeroSerie ? ` • Série: ${ext.numeroSerie}` : ""}
                      </div>

                      <div style={{ marginTop: 8, color: cor.text, fontWeight: 900 }}>
                        {textoStatusExtintor(ext.vencimento)}
                      </div>

                      <div style={{ marginTop: 6, color: theme.textSoft }}>
                        Vencimento: {ext.vencimento}
                      </div>

                      {ext.observacoes ? (
                        <div style={{ marginTop: 6, color: theme.textMuted }}>
                          {ext.observacoes}
                        </div>
                      ) : null}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 10,
                        flexWrap: "wrap",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => enviarWhatsAppExtintor(ext)}
                        style={getButtonStyle("secondary")}
                      >
                        Avisar no WhatsApp
                      </button>

                      <button
                        type="button"
                        onClick={() => enviarEmailExtintor(ext)}
                        style={getButtonStyle("ghost")}
                      >
                        Avisar por e-mail
                      </button>

                      {PERFIL_ATUAL === "admin" ? (
                        <button
                          type="button"
                          onClick={() => removerExtintor(ext.id)}
                          style={getButtonStyle("danger")}
                        >
                          Excluir extintor
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const abas: { key: Aba; label: string }[] = [
    { key: "dashboard", label: "Dashboard" },
    { key: "pedido", label: "Novo pedido" },
    { key: "historico", label: "Histórico" },
    { key: "clientes", label: "Clientes" },
    { key: "cadastro", label: "Cadastro" },
    { key: "extintores", label: "Extintores" },
  ];

  return (
    <div style={ui.app}>
      <div style={ui.container}>
        <header style={ui.hero}>
          <div style={ui.eyebrow}>ROTA EXTINTORES • GESTÃO DE CAMPO</div>

          <h1 style={ui.heroTitle}>Rota App</h1>

          <p style={ui.heroText}>
            Sistema comercial e operacional para cadastro de clientes, emissão de
            pedidos, histórico de atendimento, controle de extintores e alertas de
            vencimento com semáforo visual.
          </p>

          <div
            style={{
              ...ui.heroStrip,
              gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))",
            }}
          >
            <div style={ui.heroStripCard}>
              <div style={ui.heroStripLabel}>Clientes ativos</div>
              <div style={ui.heroStripValue}>{clientes.length}</div>
            </div>

            <div style={ui.heroStripCard}>
              <div style={ui.heroStripLabel}>Pedidos lançados</div>
              <div style={ui.heroStripValue}>{pedidos.length}</div>
            </div>

            <div style={ui.heroStripCard}>
              <div style={ui.heroStripLabel}>Extintores monitorados</div>
              <div
                style={{
                  ...ui.heroStripValue,
                  fontSize: isMobile ? 24 : 28,
                }}
              >
                {extintores.length}
              </div>
            </div>
          </div>

          <div style={ui.navWrap}>
            {abas.map((itemAba) => (
              <button
                key={itemAba.key}
                type="button"
                onClick={() => setAba(itemAba.key)}
                style={getButtonStyle("nav", aba === itemAba.key)}
              >
                {itemAba.label}
              </button>
            ))}
          </div>

          {msg ? <div style={getMensagemStyle(msg)}>{msg}</div> : null}
        </header>

        <main style={ui.pageCard}>
          {aba === "dashboard" && renderDashboard()}
          {aba === "cadastro" && renderCadastro()}
          {aba === "clientes" && renderClientes()}
          {aba === "pedido" && renderPedido()}
          {aba === "historico" && renderHistorico()}
          {aba === "extintores" && renderExtintores()}
        </main>
      </div>
    </div>
  );
}