import { Client, Account, TablesDB } from "appwrite";

const client = new Client();

client
  .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT)
  .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID);

export const account = new Account(client);
export const tablesDB = new TablesDB(client);

export const APPWRITE_DATABASE_ID = "69d088eb0007a473e872";
export const APPWRITE_CLIENTES_TABLE_ID = "clientes";
export const APPWRITE_PEDIDOS_TABLE_ID = "pedidos";

export default client;