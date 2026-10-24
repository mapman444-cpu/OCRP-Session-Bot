const {
  SlashCommandBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");

const channelId = "1562601772185550899";

module.exports = {
  roles: ["1556797424977182821"],

  data: new SlashCommandBuilder()
    .setName("session-start")
    .setDescription("Host a session start up."),

  async execute(interaction, client) {
    await interaction.deferReply({
      flags: MessageFlags.Ephemeral,
    });
    
    try {
      const serverName = "Orlando State Roleplay";
      const serverOwner = "Ykaldjane2319";
      const joinCode = "OSRPPP";

      const headerImage =
        "https://cdn.discordapp.com/attachments/1562258264882806814/1562604852763426987/336A9E81-9370-4B7C-8DDF-79658B2B20F9.png";

      const robloxJoinUrl =
        "roblox://placeId=2534724415&launchData=%7B%22psCode%22%3A%22OSRPPP%22%7D";

      if (!client.voteMap) {
        client.voteMap = new Map();
      }

      const activePollId = client.activePollId;

      const voters = activePollId
        ? client.voteMap.get(activePollId)
        : null;

      const voterIds = voters
        ? [...voters.values()].map(voter => voter.userId)
        : [];

      const votersList = voterIds.length > 0
        ? voterIds.map(id => `<@${id}>`).join(", ")
        : "**No voters!**";

      const roleIds = [
        "1556729983546957875",
        "1556428127553724506",
      ];

      const container = new ContainerBuilder()
        .setAccentColor(0x37373E)
        .addMediaGalleryComponents(
          new MediaGalleryBuilder().addItems(
            new MediaGalleryItemBuilder()
              .setURL(headerImage)
              .setDescription("Orlando Roleplay banner")
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
              .setURL(robloxJoinUrl)
              .setStyle(ButtonStyle.Link)
          )
        );

      const channel = await interaction.guild.channels.fetch(channelId);

      if (!channel || !channel.isTextBased()) {
        throw new Error("The session startup channel could not be found.");
      }

      // Delete the active session vote poll.
      if (client.activePollMessageId) {
        try {
          const pollMessage = await channel.messages.fetch(
            client.activePollMessageId
          );

          await pollMessage.delete();
        } catch (error) {
          if (error.code !== 10008) {
            console.error(
              "Failed to delete the session vote poll:",
              error
            );
          }
        }

        client.activePollMessageId = null;
      }

      await channel.send({
        components: [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              roleIds.map(id => `<@&${id}>`).join(" ")
            )
          ),
          container,
        ],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: {
          roles: roleIds,
          users: voterIds,
        },
      });

      client.sessionStatus = "online";

      if (typeof client.refreshSessionPanel === "function") {
        await client.refreshSessionPanel();
      }

      await interaction.editReply({
        content: "Successfully hosted a session start-up!",
      });
    } catch (error) {
      console.error("Error executing /session-start:", error);

      await interaction.editReply({
        content: "The session startup encountered an error. Check the bot console.",
      }).catch(() => {});
    }
  },
};
