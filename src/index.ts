import { Client } from "./structures/client.js";
import clientOptions from "./config/config.json";
import { config } from "dotenv";
import { ClientOptions } from "./types.js";

config();

const client = new Client(clientOptions as ClientOptions);

const token = process.env["TOKEN"];

if (token === undefined) {
  console.error("No token found");

  process.exit(1);
}

await client.start(token);
