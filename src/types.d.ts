import * as Discord from "discord.js";
import type { Client } from "./structures/client.js";

interface Roles {
  competitionPing: Discord.Snowflake;
}

interface Channels {
  competitionUpdates: Discord.Snowflake;
}

interface ClientOptions extends Discord.ClientOptions {
  commandsPath: string;
  eventsPath: string;
  deleteUnusedSlashCommands: boolean;
  guildID: string;
  dev: boolean;
  devID: string;
  roles: Roles;
  channels: Channels;
}

interface Command<T extends Discord.ApplicationCommandType = "CHAT_INPUT"> {
  name: string;
  description?: string;
  category: string;
  type?: T;
  options?: Discord.ApplicationCommandOption[];
  needsPermissions?: boolean;
  run: (
    interaction: T extends "CHAT_INPUT"
      ? Discord.CommandInteraction
      : T extends "MESSAGE"
      ? Discord.MessageContextMenuInteraction
      : Discord.UserContextMenuInteraction,
    client: Client<true>
  ) => void;
}

interface Event<E extends keyof Discord.ClientEvents> {
  event: E;
  run: (client: Client<true>, ...eventArgs: Discord.ClientEvents[E]) => void;
}
