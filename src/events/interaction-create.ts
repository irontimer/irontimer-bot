import * as Discord from "discord.js";
import type { Client } from "../structures/client.js";
import type { Event, Command } from "../types.js";

export default {
  event: "interactionCreate",
  run: async (client, interaction) => {
    if (interaction.isCommand() && interaction.channel?.type !== "DM") {
      console.log(`Command Interaction ran. "${interaction.commandName}"`);

      runCommand(interaction, client);
    } else if (interaction.isAutocomplete()) {
      console.log(`Autocomplete Interaction ran. "${interaction.commandName}"`);
    } else if (interaction.isButton()) {
      console.log(`Button Interaction ran. "${interaction.customId}"`);
    } else if (interaction.isContextMenu()) {
      console.log(`Context Menu Interaction ran. "${interaction.commandName}"`);

      if (
        interaction.isMessageContextMenu() ||
        interaction.isUserContextMenu()
      ) {
        runCommand(interaction, client);
      }
    } else if (interaction.isSelectMenu()) {
      console.log(`Select Menu Interaction ran. "${interaction.customId}"`);
    }
  }
} as Event<"interactionCreate">;

async function runCommand(
  interaction:
    | Discord.CommandInteraction
    | Discord.MessageContextMenuInteraction
    | Discord.UserContextMenuInteraction,
  client: Client<true>
): Promise<void> {
  const commandName = interaction.commandName;

  const command = client.commands.get(
    commandName
  ) as Command<Discord.ApplicationCommandType>;

  if (command === undefined) {
    interaction.reply("Could not find this command.");

    return;
  }

  if (
    !client.clientOptions.dev &&
    !client.permissionsAdded.has(interaction.guild?.id ?? "") &&
    command.name !== "unlock-commands"
  ) {
    interaction.reply(
      `❌ Commands have not been unlocked for this server.\nServer owner must run /unlock-commands to unlock commands`
    );

    return;
  }

  console.log(`Running command "${command.name}"`);

  try {
    command.run(interaction, client);
  } catch (err) {
    console.log(`An error occured running command "${command.name}"\n${err}`);

    const msg = `❌ Unexpected error occured. Please report this.`;

    interaction.reply(msg).catch(() => {
      console.log("Couldn't reply, sending followUp instead.");

      interaction.followUp(msg).catch(console.log);
    });
  }
}
