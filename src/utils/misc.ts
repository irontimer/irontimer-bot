import * as Discord from "discord.js";
import { fileURLToPath } from "url";
import { dirname as pathDirname } from "path";

export function dirname(url: string = import.meta.url): string {
  return pathDirname(fileURLToPath(url));
}

export async function getMessagesRecursively(
  channel: Discord.TextChannel
): Promise<Discord.Message[]> {
  const messages = await channel.messages.fetch({ limit: 100 });

  if (messages.size === 100) {
    return [...messages.values(), ...(await getMessagesRecursively(channel))];
  }

  return [...messages.values()];
}
