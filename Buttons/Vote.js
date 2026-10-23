
const {
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MediaGalleryBuilder,
  MessageFlags,
} = require("discord.js");

const cooldowns = new Map();
const COOLDOWN_TIME = 3000;
const REQUIRED_VOTES = 15;

const HEADER_IMAGE =
  "https://cdn.discordapp.com/attachments/1562258264882806814/1562604852763426987/336A9E81-9370-4B7C-8DDF-79658B2B20F9.png";

const CHANNEL_ID = "1562601772185550899";

const ROLE_IDS = [
  "1556729983546957875",
  "1556428127553724506",
];

function buildVotePanel(sessionId, count, hasVoted) {
  return new ContainerBuilder()
    .setAccentColor(0x37373E)
    .addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(item =>
        item.setURL(HEADER_IMAGE)
      )
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent([
        "# Orlando Roleplay Session Vote",
        "> A session vote has been initiated! Please click the *vote* button to show our staff that you are interested in joining the session!",
        "> Make sure to read over our rules prior to joining! Those can be found in https://discord.com/channels/1556394472445845519/1556419599384313966.",
      ].join("\n"))
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`vote:button_${sessionId}`)
          .setLabel(`${count}/${REQUIRED_VOTES}`)
          .setStyle(
            hasVoted ? ButtonStyle.Success : ButtonStyle.Secondary
          ),
        new ButtonBuilder()
          .setCustomId(`viewvote:button_${sessionId}`)
          .setLabel(`View Voters (${count})`)
          .setStyle(ButtonStyle.Secondary)
      )
    );
}

module.exports = {
  customID: "vote:button",

  execute: async function (interaction, client, args) {
    const sessionId = args[0];

    if (!sessionId) {
      return interaction.reply({
        content: "Unable to identify this session vote.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const userId = interaction.user.id;
    const now = Date.now();
    const expiresAt = cooldowns.get(userId);

    if (expiresAt && now < expiresAt) {
      return interaction.reply({
        content: `You are on **cooldown**. Please try again <t:${Math.floor(expiresAt / 1000)}:R>.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    cooldowns.set(userId, now + COOLDOWN_TIME);

    setTimeout(() => {
      if (cooldowns.get(userId) === now + COOLDOWN_TIME) {
        cooldowns.delete(userId);
      }
    }, COOLDOWN_TIME);

    if (!client.voteMap) {
      client.voteMap = new Map();
    }

    if (!client.voteMap.has(sessionId)) {
      client.voteMap.set(sessionId, new Map());
    }

    const sessionVotes = client.voteMap.get(sessionId);
    const hasVoted = sessionVotes.has(userId);

    if (hasVoted) {
      sessionVotes.delete(userId);
    } else {
      sessionVotes.set(userId, {
        userId,
        timestamp: Date.now(),
      });
    }

    // Keep the active poll ID synchronized with the poll being voted on.
    client.activePollId = sessionId;

    const count = sessionVotes.size;

    try {
      await interaction.update({
        components: [
          ...(interaction.message.components.length > 1
            ? [interaction.message.components[0]]
            : []),
          buildVotePanel(sessionId, count, !hasVoted),
        ],
        flags: MessageFlags.IsComponentsV2,
      });

      await interaction.followUp({
        content: hasVoted
          ? "**Successfully** removed your vote!"
          : "**Successfully** counted your vote!",
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      console.error("Error updating the vote panel:", error);
      return;
    }

    if (count < REQUIRED_VOTES) {
      return;
    }

    if (!client.completedPolls) {
      client.completedPolls = new Set();
    }

    if (client.completedPolls.has(sessionId)) {
      return;
    }

    client.completedPolls.add(sessionId);

    const votersList = [...sessionVotes.values()]
      .map(voter => `<@${voter.userId}>`)
      .join(", ") || "**No voters!**";

    const serverName = "Orlando State Roleplay";
    const serverOwner = "Ykaldjane2319";
    const joinCode = "OSRPPP";

    const startupContainer = new ContainerBuilder()
      .setAccentColor(0x37373E)
      .addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(item =>
          item.setURL(HEADER_IMAGE)
        )
      )
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent([
          "# Orlando Roleplay Session Startup",
          "> A server start-up has been initiated! Please ensure you have read and understood our regulations prior to joining.",
          "",
          "## Game Information",
          `> **Server Name:** ${serverName}`,
          `> **Server Owner:** ${serverOwner}`,
          `> **Join Code:** ${joinCode}`,
        ].join("\n"))
      )
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `## Session Voters\n${votersList}`
        )
      )
      .addSeparatorComponents(new SeparatorBuilder())
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel("Quick Join")
            .setURL("https://discord.gg/osrp")
            .setStyle(ButtonStyle.Link)
        )
      );

    try {
      const channel = await interaction.client.channels.fetch(CHANNEL_ID);

      if (!channel || !channel.isTextBased()) {
        throw new Error("The session startup channel could not be found.");
      }

      const voterIds = [...sessionVotes.values()]
        .map(voter => voter.userId);

      await channel.send({
        components: [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              ROLE_IDS.map(id => `<@&${id}>`).join(" ")
            )
          ),
          startupContainer,
        ],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: {
          roles: ROLE_IDS,
          users: voterIds,
        },
      });

      client.sessionStatus = "online";

      if (typeof client.refreshSessionPanel === "function") {
        await client.refreshSessionPanel();
      }

      client.voteMap.delete(sessionId);

      if (client.activePollId === sessionId) {
        client.activePollId = null;
      }
    } catch (error) {
      console.error("Failed to send the session startup announcement:", error);
      client.completedPolls.delete(sessionId);
    }
  },
};
