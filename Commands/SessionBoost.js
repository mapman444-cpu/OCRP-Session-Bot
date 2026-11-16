
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

const channelId = "1556685797703553144";

module.exports = {
  roles: ["1556797424977182821"],

  data: new SlashCommandBuilder()
    .setName("session-boost")
    .setDescription("Sends a boost ping."),

  async execute(interaction, client) {
    await interaction.deferReply({
      flags: MessageFlags.Ephemeral,
    });

    try {
      const headerImage =
        "https://cdn.discordapp.com/attachments/1558959335034458293/1565533888103710860/8887C557-6D47-4F63-A7BF-EEEBCB9D6D65.png?ex=6afc52cd&is=6afb014d&hm=3b1aeccd1286fde6c06733d9f47cef8fb22b142806894851290494b4cdf29230";

      const container = new ContainerBuilder()
        .setAccentColor(0x37373E)
        .addMediaGalleryComponents(
          new MediaGalleryBuilder().addItems(
            item => item.setURL(headerImage)
          )
        )
        .addSeparatorComponents(
          new SeparatorBuilder()
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            [
              "# Orlando Roleplay Session Boost",
              "> The in-game server count is currently **low**.",
              "> Join up to skip the queue and participate in some amazing roleplays!",
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
              .setURL("https://erlc.gg/join?code=OSRPPP")
              .setStyle(ButtonStyle.Link)
          )
        );

      const roleIds = [
  "1556729983546957875",
  "1556428127553724506"
];

      const channel = await client.channels.fetch(channelId);

      if (!channel || !channel.isTextBased()) {
        throw new Error("The session boost channel could not be found.");
      }

      await channel.send({
  components: [
    new ContainerBuilder()
      .addTextDisplayComponents(
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

      await interaction.editReply({
        content: "Sucessfully sent a session boost!",
      });
    } catch (error) {
      console.error("Error executing /ssu-boost:", error);

      await interaction.editReply({
        content: "There was an error sending the session boost. Check the bot console.",
      }).catch(() => {});
    }
  },
};
