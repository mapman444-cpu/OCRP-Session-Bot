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

const channelId = "1556685797703553144";

module.exports = {
  roles: ["1556797424977182821"],

  data: new SlashCommandBuilder()
    .setName("session-full")
    .setDescription("Send the session full message."),

  async execute(interaction, client) {
    await interaction.deferReply({
      flags: MessageFlags.Ephemeral,
    });

    try {
      const timestamp = `<t:${Math.floor(Date.now() / 1000)}:R>`;

      const headerImage =
        "https://cdn.discordapp.com/attachments/1558959335034458293/1565533888103710860/8887C557-6D47-4F63-A7BF-EEEBCB9D6D65.png?ex=6afc52cd&is=6afb014d&hm=3b1aeccd1286fde6c06733d9f47cef8fb22b142806894851290494b4cdf29230";

      const container = new ContainerBuilder()
        .setAccentColor(0x37373E)
        .addMediaGalleryComponents(
          new MediaGalleryBuilder().addItems(
            new MediaGalleryItemBuilder()
              .setURL(headerImage)
              .setDescription("Orlando Roleplay banner")
          )
        )
        .addSeparatorComponents(
          new SeparatorBuilder()
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            [
              "# Server name Session Full",
              `> The session has been full since **${timestamp}**.`,
              "> Keep trying to join us for some amazing roleplays!",
              "",
              "> **Server Name:** Server name",
              "> **Server Owner:** Server owner",
              "> **Join Code:** Server code",
            ].join("\n")
          )
        )
        .addSeparatorComponents(
          new SeparatorBuilder()
        )
        .addActionRowComponents(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setLabel("Quick Join")
              .setStyle(ButtonStyle.Link)
              .setURL("https://erlc.gg/join?code=OSRPPP")
          )
        );

      const channel = await client.channels.fetch(channelId);

      if (!channel || !channel.isTextBased()) {
        throw new Error("The session-full channel could not be found.");
      }

      await channel.send({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: {
          parse: [],
        },
      });

      await interaction.editReply({
        content: "Session has been marked as full!",
      });
    } catch (error) {
      console.error("Failed to send session full message:", error);

      await interaction.editReply({
        content: "There was an error sending the session-full message. Check the bot console.",
      }).catch(() => {});
    }
  },
};
