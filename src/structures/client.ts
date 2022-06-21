import * as Discord from "discord.js";
import type { Channels, ClientOptions, Command, Event } from "../types.js";
import { promisify } from "util";
import { join } from "path";
import type { APIMessage } from "discord-api-types/v10";
import globCB from "glob";
import _ from "lodash";
import { dirname } from "../utils/misc.js";

const __dirname = dirname(import.meta.url);

interface PaginationOptions<T> {
  embedOptions: Discord.MessageEmbedOptions;
  interaction: Discord.CommandInteraction;
  amount: number;
  entries: T[];
  id: string;
  fieldName: string;
  send?: (
    embed: Discord.MessageEmbed,
    row: Discord.MessageActionRow,
    currentEntries: T[]
  ) => Promise<Discord.Message | APIMessage>;
  onPageChange?: (
    embed: Discord.MessageEmbed,
    currentEntries: T[]
  ) => Discord.MessageEmbed;
}

export class Client<T extends boolean> extends Discord.Client<T> {
  public static timeoutTime = 60000;
  public static siteURL = "www.irontimer.com";
  public static iconURL = "https://i.imgur.com/tNOSzmQ.png";
  public static glob = promisify(globCB);
  public clientOptions: ClientOptions;
  public commands = new Discord.Collection<string, Command>();
  public categories = new Array<string>();
  public permissionsAdded = new Set<string>();

  constructor(options: ClientOptions) {
    super(options);

    this.clientOptions = options;
  }

  public async start(token: string): Promise<string> {
    await this.login(token);

    const [commands, events] = await this.load();

    this.emit("ready", this as Client<true>);

    return `Loaded ${commands} commands and ${events} events`;
  }

  public async load(): Promise<[number, number]> {
    const commandFiles = await Client.glob(
      join(__dirname, "../", this.clientOptions.commandsPath, "**", "*.{ts,js}")
    );

    const eventFiles = await Client.glob(
      join(__dirname, "../", this.clientOptions.eventsPath, "**", "*.{ts,js}")
    );

    const commands = (await Promise.all(
      commandFiles.map(
        async (commandFilePath) =>
          (await import(commandFilePath)).default ||
          (await import(commandFilePath))
      )
    )) as Command[];

    const events = (await Promise.all(
      eventFiles.map(
        async (eventFilePath) =>
          (await import(eventFilePath)).default || (await import(eventFilePath))
      )
    )) as Event<keyof Discord.ClientEvents>[];

    for (const event of events) {
      this.on(event.event, event.run.bind(null, this as Client<true>));
    }

    // Handing application commands

    const fetchOptions = {
      guildId: this.clientOptions.guildID,
      cache: true
    };

    const slashCommands = await this.application?.commands.fetch(fetchOptions);

    for (const command of commands) {
      this.commands.set(command.name, command);

      if (!this.categories.includes(command.category)) {
        this.categories.push(command.category);
      }

      const cmd = slashCommands?.find((c) => c.name === command.name);

      if (cmd === undefined) {
        const type = command.type ?? "CHAT_INPUT";

        const c = await this.application?.commands
          .create(
            {
              name: command.name,
              description:
                type === "CHAT_INPUT"
                  ? command.description ?? "No description provided"
                  : "",
              type,
              options: command.options as Discord.ApplicationCommandOptionData[]
            },
            this.clientOptions.guildID
          )
          .catch(console.log);

        if (c === undefined) {
          console.log(`Error creating command "${command.name}"`);
        } else {
          console.log(`Created command "${c.name}" (${c.id})`);
        }
      } else {
        const mapper = (
          option: Discord.ApplicationCommandOption
        ): Discord.ApplicationCommandOption => {
          type Keys = keyof typeof option;

          type Values = typeof option[Keys];

          type Entries = [Keys, Values];

          for (const [key, value] of Object.entries(option) as Entries[]) {
            if (
              value === undefined ||
              (_.isArray(value) && value.length === 0)
            ) {
              delete option[key];
            }
          }

          return option;
        };

        const cmdObject = {
          name: cmd.name,
          description: cmd.description,
          type: cmd.type,
          options: cmd.options.map(mapper)
        };

        const type = command.type ?? "CHAT_INPUT";

        const commandObject = {
          name: command.name,
          description:
            type === "CHAT_INPUT"
              ? command.description ?? "No description provided"
              : "",
          type,
          options: (command.options ?? []).map(mapper)
        };

        if (_.isEqual(cmdObject, commandObject)) {
          continue;
        }

        await this.application?.commands.edit(
          cmd,
          {
            ...commandObject,
            options: command.options as Discord.ApplicationCommandOptionData[]
          },
          this.clientOptions.guildID
        );

        console.log(`Edited command "${cmd.name}" (${cmd.id})`);
      }
    }

    return [this.commands.size, events.length];
  }

  public embed(
    embedOptions: Discord.MessageEmbedOptions,
    user?: Discord.User
  ): Discord.MessageEmbed {
    if (!embedOptions.footer?.text?.includes(Client.siteURL)) {
      embedOptions.footer = {
        text: `${Client.siteURL}${
          embedOptions.footer?.text !== undefined
            ? ` | ${embedOptions.footer.text}`
            : ""
        }`,
        iconURL: Client.iconURL
      };
    }

    if (embedOptions.author === undefined && user !== undefined) {
      embedOptions.author = {
        name: user.username,
        iconURL: user.avatarURL({ dynamic: true }) ?? ""
      };
    }

    const embed = new Discord.MessageEmbed(embedOptions);

    if (!embed.timestamp) {
      embed.setTimestamp();
    }

    return embed;
  }

  public async paginate<T>(options: PaginationOptions<T>): Promise<void> {
    const {
      embedOptions,
      interaction,
      amount,
      entries,
      id,
      fieldName,
      send,
      onPageChange
    } = options;

    const maxPage =
      entries.length === 0 ? 1 : Math.ceil(entries.length / amount);

    let page = 0;

    if (embedOptions.fields === undefined) {
      embedOptions.fields = [];
    }

    const currentEntries = entries.slice(page * amount, page * amount + amount);

    embedOptions.fields.push({
      name: fieldName,
      value: currentEntries.join("\n") || "None"
    });

    let embed = this.embed(embedOptions);

    const row = new Discord.MessageActionRow();

    row.addComponents([
      new Discord.MessageButton()
        .setCustomId(`${id.toLowerCase()}PreviousPage`)
        .setEmoji("⬅️")
        .setLabel("Previous")
        .setStyle("PRIMARY")
        .setDisabled(false),
      new Discord.MessageButton()
        .setCustomId(`${id.toLowerCase()}PageDisplay`)
        .setLabel(`Page ${page + 1} of ${maxPage}`)
        .setStyle("SECONDARY")
        .setDisabled(true),
      new Discord.MessageButton()
        .setCustomId(`${id.toLowerCase()}NextPage`)
        .setEmoji("➡️")
        .setLabel("Next")
        .setStyle("PRIMARY")
        .setDisabled(false)
    ]);

    const msg =
      send === undefined
        ? await interaction.reply({
            embeds: [embed],
            components: maxPage === 1 ? undefined : [row],
            fetchReply: true
          })
        : await send(embed, row, currentEntries);

    if (interaction.channel === null) {
      console.log("Channel is null");

      return;
    }

    const collector = interaction.channel?.createMessageComponentCollector({
      componentType: "BUTTON",
      dispose: true,
      message: msg,
      time: Client.timeoutTime
    });

    collector.on("collect", (buttonInteraction) => {
      if (!buttonInteraction.isButton()) {
        return;
      }

      buttonInteraction.deferUpdate();

      if (buttonInteraction.customId === `${id.toLowerCase()}PreviousPage`) {
        if (page <= 0) {
          page = 0;

          return;
        }

        page--;
      } else if (buttonInteraction.customId === `${id.toLowerCase()}NextPage`) {
        if (page >= maxPage - 1) {
          page = maxPage - 1;

          return;
        }

        page++;
      }

      if (embedOptions.fields === undefined) {
        embedOptions.fields = [];
      }

      const pageChangeEntries = entries.slice(
        page * amount,
        page * amount + amount
      );

      embedOptions.fields[
        embedOptions.fields.findIndex((field) => field.name === fieldName)
      ] = {
        name: fieldName,
        value: pageChangeEntries.join("\n") || "None",
        inline: false
      };

      embed = this.embed(embedOptions);
      if (onPageChange !== undefined) {
        embed = onPageChange(embed, pageChangeEntries);
      }

      if (row.components[1]) {
        (row.components[1] as Discord.MessageButton).setLabel(
          `Page ${page + 1} of ${maxPage}`
        );
      }

      interaction.editReply({
        embeds: [embed],
        components: maxPage === 1 ? undefined : [row]
      });
      buttonInteraction.update({});
    });
  }

  public async awaitMessageComponent<T extends Discord.MessageComponentType>(
    channel: Discord.TextBasedChannel | null | undefined,
    filter: Discord.CollectorFilter<[Discord.MappedInteractionTypes<true>[T]]>,
    componentType: T,
    time = Client.timeoutTime
  ): Promise<Discord.MappedInteractionTypes[T] | undefined> {
    return channel
      ?.awaitMessageComponent<T>({
        componentType,
        filter,
        time,
        dispose: true
      })
      .catch(() => undefined);
  }

  public get guild(): Promise<Discord.Guild | undefined> {
    return this.guilds.fetch({
      guild: this.clientOptions.guildID,
      cache: true
    });
  }

  public getCommandsByCategory(category: string): Command[] {
    return Array.from(
      this.commands.filter((cmd) => cmd.category === category).values()
    );
  }

  public async getChannel(
    channel: keyof Channels
  ): Promise<Discord.TextChannel | undefined> {
    const guild = await this.guild;

    const guildChannel = guild?.channels?.cache.find(
      (ch) => ch.id === this.clientOptions.channels[channel]
    );

    if (!guildChannel?.isText()) {
      return;
    }

    if (guildChannel.type !== "GUILD_TEXT") {
      return;
    }

    return guildChannel;
  }
}
