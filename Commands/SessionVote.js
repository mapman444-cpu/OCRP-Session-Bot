const {
  SlashCommandBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MediaGalleryBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");

const crypto = require("crypto");

const channelId = "1556685797703553144";

module.exports = {
  roles: ["1556797424977182821"],

  data: new SlashCommandBuilder()
    .setName("ssu-vote")
    .setDescription("Host a session vote."),

  generateSessionId() {
    return crypto.randomBytes(6).toString("hex");
  },

  async execute(interaction, client) {
    await interaction.deferReply({
      flags: MessageFlags.Ephemeral,
    });

    try {
      const pollSessionId = this.generateSessionId();

      const container = new ContainerBuilder()
        .setAccentColor(0x37373E)
        .addMediaGalleryComponents(
          new MediaGalleryBuilder().addItems(
            item =>
              item
                .setURL(
                  "https://cdn.discordapp.com/attachments/1562258264882806814/1562604852763426987/336A9E81-9370-4B7C-8DDF-79658B2B20F9.png?ex=6ada98ac&is=6ad9472c&hm=cfe259242925dbfdf8d7fc315b4f0ee431f096e7bf9efb30d061c5b6b43539bd&"
                )
          )
        )
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            [
              "# Orlando Roleplay Session Vote",
              "> A session vote has been initiated! Click the *vote* button below to show our staff that you are interested in joining the session!",
              "> Make sure to read over our rules prior to joining! Those can be found in https://discord.com/channels/1556394472445845519/1556419599384313966.",
            ].join("\n")
          )
        )
        .addSeparatorComponents(new SeparatorBuilder())
        .addActionRowComponents(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`vote:button_${pollSessionId}`)
              .setLabel("Vote")
              .setStyle(ButtonStyle.Secondary),

            new ButtonBuilder()
              .setCustomId(`viewvote:button_${pollSessionId}`)
              .setLabel("View Voters")
              .setStyle(ButtonStyle.Secondary)
          )
        );

      const roleIds = [
        "1556729983546957875",
        "1556428127553724506",
      ];

      const channel = await client.channels.fetch(channelId);

      if (!channel || !channel.isTextBased()) {
        throw new Error("The session vote channel could not be found.");
      }

      // Send the vote poll and save its message ID.
      const pollMessage = await channel.send({
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
        },
      });

      // Save the active poll information for /ssu.
      client.activePollId = pollSessionId;
      client.activePollMessageId = pollMessage.id;

      if (!client.voteMap) {
        client.voteMap = new Map();
      }

      client.voteMap.set(pollSessionId, new Map());

      await interaction.editReply({
        content: "Successfully sent a session vote.",
      });
    } catch (error) {
      console.error("Error executing /ssu-vote:", error);

      await interaction.editReply({
        content: `Failed to host the session vote: ${error.message}`.slice(0, 2000),
      }).catch(console.error);
    }
  },
};
