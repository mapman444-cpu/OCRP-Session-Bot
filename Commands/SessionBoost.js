
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

const channelId = "1562601772185550899";

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
        "https://cdn.discordapp.com/attachments/1562258264882806814/1562604852763426987/336A9E81-9370-4B7C-8DDF-79658B2B20F9.png?ex=6ada98ac&is=6ad9472c&hm=cfe259242925dbfdf8d7fc315b4f0ee431f096e7bf9efb30d061c5b6b43539bd&";

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
              .setURL("https://discord.gg/osrp")
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
