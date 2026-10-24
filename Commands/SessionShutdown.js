
const {
  SlashCommandBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
} = require("discord.js");

const SessionsModel = require("../Models/SessionsModel");

const channelId = "1556685797703553144";

module.exports = {
  roles: ["1556797424977182821"],

  data: new SlashCommandBuilder()
    .setName("session-shutdown")
    .setDescription("Host a session shutdown."),

  async execute(interaction, client) {
    await interaction.deferReply({
      flags: MessageFlags.Ephemeral,
    });

    try {
      const notificationRoleId = "1556729983546957875";

      const headerImage =
        "https://cdn.discordapp.com/attachments/1562258264882806814/1562604852763426987/336A9E81-9370-4B7C-8DDF-79658B2B20F9.png";

      const channel = await interaction.guild.channels.fetch(channelId);

      if (!channel || !channel.isTextBased() || !channel.messages) {
        throw new Error("The session shutdown channel could not be found.");
      }

      // Protect the persistent -embed session status panel.
      const savedSession = await SessionsModel.findOne({ channelId });
      const protectedPanelId = savedSession?.messageId;

      // Only delete messages that can be identified as session announcements.
      const sessionKeywords = [
        "orlando roleplay session startup",
        "orlando roleplay session start-up",
        "orlando roleplay session start",
        "orlando roleplay session boost",
        "orlando roleplay session full",
        "orlando roleplay session vote",
      ];

      let before;
      let deletedCount = 0;

      while (true) {
        const options = { limit: 100 };

        if (before) {
          options.before = before;
        }

        const messages = await channel.messages.fetch(options);

        if (messages.size === 0) {
          break;
        }

        before = messages.last().id;

        for (const message of messages.values()) {
          // Only remove messages sent by this bot.
          if (message.author.id !== client.user.id) {
            continue;
          }

          // Never delete the persistent -embed status panel.
          if (message.id === protectedPanelId) {
            continue;
          }

          const componentText = message.components
            .map(component => JSON.stringify(component.toJSON()))
            .join(" ");

          const embedText = message.embeds
            .map(embed => JSON.stringify(embed.toJSON()))
            .join(" ");

          const searchableText = [
            message.content,
            componentText,
            embedText,
          ].join(" ").toLowerCase();

          const isSessionAnnouncement = sessionKeywords.some(keyword =>
            searchableText.includes(keyword)
          );

          if (!isSessionAnnouncement) {
            continue;
          }

          try {
            await message.delete();
            deletedCount++;
          } catch (error) {
            console.error(
              `Could not delete session message ${message.id}:`,
              error.message
            );
          }
        }

        if (messages.size < 100) {
          break;
        }
      }

      // Build the shutdown announcement.
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
              "# Orlando Roleplay Session Shutdown",
              "",
              "> The in-game server is currently shut down. Please refrain from attempting to join during this time.",
              "",
              `> Be sure to obtain the <@&${notificationRoleId}> role to be notified about the next session!`,
              "",
              "# Thanks for a great session, Orlando! We will be back tomorrow!",
            ].join("\n")
          )
        )
        .addSeparatorComponents(
          new SeparatorBuilder()
        );

      // Post the shutdown announcement without pinging roles.
      await channel.send({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: {
          parse: [],
        },
      });

      // Update the persistent session status panel.
      client.sessionStatus = "offline";

      if (typeof client.refreshSessionPanel === "function") {
        await client.refreshSessionPanel();
      }

      await interaction.editReply({
        content: "Sucessfully shutdown the ingame server. ",
      });

      console.log(
        `Session shutdown completed. Deleted ${deletedCount} session announcement(s).`
      );
    } catch (error) {
      console.error("Error executing /session-shutdown:", error);

      await interaction.editReply({
        content: "The session shutdown encountered an error. Check the bot console.",
      }).catch(() => {});
    }
  },
};
