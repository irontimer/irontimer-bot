import { Client } from "../structures/client.js";
import type { Event } from "../types.js";
import { fetchCompetitions } from "../utils/competition.js";
import { getMessagesRecursively } from "../utils/misc.js";

export default {
  event: "ready",
  run: (client) => {
    console.log(`${client.user.tag} is online!`);

    const func = (): void => {
      sendCompetitionUpdates(client);
    };

    func();

    setInterval(func, 60 * 60 * 1000);
  }
} as Event<"ready">;

async function sendCompetitionUpdates(client: Client<true>): Promise<void> {
  const guild = await client.guild;
  const channel = await client.getChannel("competitionUpdates");
  const challengePingRole =
    (await guild?.roles.fetch(client.clientOptions.roles.competitionPing)) ??
    undefined;

  if (
    channel === undefined ||
    guild === undefined ||
    challengePingRole === undefined
  ) {
    return;
  }

  const messages = await getMessagesRecursively(channel);

  const [upcoming, inProgress] = await fetchCompetitions();

  const newUpcoming = upcoming.filter(
    (competition) =>
      !messages.some((message) => {
        const embed = message.embeds[0];

        if (embed === undefined) {
          return false;
        }

        return (
          embed.title === competition.name &&
          embed.url === competition.url &&
          embed.description === "This is a new upcoming competition."
        );
      })
  );

  const newInProgress = inProgress.filter(
    (competition) =>
      !messages.some((message) => {
        const embed = message.embeds[0];

        if (embed === undefined) {
          return false;
        }

        return (
          embed.title === competition.name &&
          embed.url === competition.url &&
          embed.description === "This competition has started."
        );
      })
  );

  const newEnded = messages.filter((message) => {
    const embed = message.embeds[0];

    if (embed === undefined) {
      return false;
    }

    return (
      embed.description === "This competition has started." &&
      !inProgress.some(
        (competition) =>
          embed.title === competition.name && embed.url === competition.url
      )
    );
  });

  for (const competition of newUpcoming) {
    const [startDate, endDate] = competition.dates;

    const embed = client.embed({
      title: competition.name,
      description: "This is a new upcoming competition.",
      url: competition.url,
      color: 0x00ff00,
      fields: [
        {
          name: "Location",
          value: competition.location
        },
        {
          name: "Start Date",
          value: startDate.toDateString(),
          inline: true
        },
        {
          name: "End Date",
          value: (endDate ?? startDate).toDateString(),
          inline: true
        }
      ]
    });

    await channel.send({
      content: challengePingRole.toString() ?? "",
      embeds: [embed]
    });
  }

  for (const competition of newInProgress) {
    const [startDate, endDate] = competition.dates;

    const embed = client.embed({
      title: competition.name,
      description: "This competition has started.",
      url: competition.url,
      color: 0xffff00,
      fields: [
        {
          name: "Location",
          value: competition.location
        },
        {
          name: "Start Date",
          value: startDate.toDateString(),
          inline: true
        },
        {
          name: "End Date",
          value: (endDate ?? startDate).toDateString(),
          inline: true
        }
      ]
    });

    await channel.send({
      content: challengePingRole.toString() ?? "",
      embeds: [embed]
    });
  }

  for (const message of newEnded) {
    const embed = message.embeds[0];

    if (embed === undefined) {
      continue;
    }

    embed.setDescription("This competition has ended.");
    embed.setColor(0xff0000);

    await channel.send({
      content: challengePingRole.toString() ?? "",
      embeds: [embed]
    });
  }
}
