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
        // Acknowledge the interaction immediately.
        try {
            await interaction.deferReply({
                flags: MessageFlags.Ephemeral,
            });
        } catch (error) {
            console.error(
                "Failed to acknowledge /session-shutdown:",
                error
            );
            return;
        }

        try {
            const notificationRoleId = "1556729983546957875";

            const headerImage =
                "https://cdn.discordapp.com/attachments/1562258264882806814/1562604852763426987/336A9E81-9370-4B7C-8DDF-79658B2B20F9.png";

            // Verify the channel.
            const channel = await interaction.guild.channels
                .fetch(channelId);

            if (
                !channel ||
                !channel.isTextBased() ||
                !channel.messages
            ) {
                throw new Error(
                    "The session shutdown channel could not be found."
                );
            }

            // Protect the persistent -embed session status panel.
            const savedSession = await SessionsModel.findOne({
                channelId,
            }).lean();

            const protectedPanelId = savedSession?.messageId;

            // Build the shutdown announcement.
            const container = new ContainerBuilder()
                .setAccentColor(0x37373E)
                .addMediaGalleryComponents(
                    new MediaGalleryBuilder().addItems(
                        new MediaGalleryItemBuilder()
                            .setURL(headerImage)
                            .setDescription(
                                "Orlando Roleplay banner"
                            )
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

            // Mark the session offline.
            client.sessionStatus = "offline";

            // Send the announcement before cleaning up old messages.
            await channel.send({
                components: [container],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: {
                    parse: [],
                },
            });

            // Refresh the persistent status panel.
            if (
                typeof client.refreshSessionPanel === "function"
            ) {
                try {
                    await client.refreshSessionPanel();
                } catch (error) {
                    console.error(
                        "Failed to refresh the session panel:",
                        error
                    );
                }
            }

            // Edit the deferred response so Discord sees a completed interaction.
            await interaction.editReply({
                content: "Successfully shut down the in-game server.",
            });

            // Delete old session announcements without deleting the panel.
            const sessionKeywords = [
                "orlando roleplay session startup",
                "orlando roleplay session start-up",
                "orlando roleplay session boost",
                "orlando roleplay session full",
                "orlando roleplay session vote",
            ];

            let before;
            let deletedCount = 0;
            let scannedCount = 0;

            // Limit cleanup to 500 messages per execution.
            const maxMessagesToScan = 500;

            while (scannedCount < maxMessagesToScan) {
                const remaining = maxMessagesToScan - scannedCount;

                const options = {
                    limit: Math.min(100, remaining),
                };

                if (before) {
                    options.before = before;
                }

                const messages = await channel.messages.fetch(options);

                if (messages.size === 0) {
                    break;
                }

                before = messages.last().id;
                scannedCount += messages.size;

                for (const message of messages.values()) {
                    // Only delete messages sent by this bot.
                    if (message.author.id !== client.user.id) {
                        continue;
                    }

                    // Never delete the persistent session status panel.
                    if (
                        protectedPanelId &&
                        message.id === protectedPanelId
                    ) {
                        continue;
                    }

                    const componentText = message.components
                        .map(component =>
                            JSON.stringify(component.toJSON())
                        )
                        .join(" ");

                    const embedText = message.embeds
                        .map(embed =>
                            JSON.stringify(embed.toJSON())
                        )
                        .join(" ");

                    const searchableText = [
                        message.content,
                        componentText,
                        embedText,
                    ]
                        .join(" ")
                        .toLowerCase();

                    const isSessionAnnouncement =
                        sessionKeywords.some(keyword =>
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

                if (messages.size < options.limit) {
                    break;
                }
            }

            console.log(
                [
                    "Session shutdown completed.",
                    `Scanned ${scannedCount} messages.`,
                    `Deleted ${deletedCount} session announcement(s).`,
                ].join(" ")
            );
        } catch (error) {
            console.error(
                "Error executing /session-shutdown:",
                error
            );

            await interaction.editReply({
                content:
                    "The session shutdown encountered an error. Check the bot console.",
            }).catch(() => {});
        }
    },
};
