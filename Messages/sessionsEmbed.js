
const {
    ContainerBuilder,
    TextDisplayBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    SeparatorBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} = require("discord.js");

const axios = require("axios");
const SessionsModel = require("../Models/SessionsModel");

module.exports = {
    name: "embed",
    description: "Send and update the session status panel.",

    run: async (client, message, args) => {
        if (message?.delete) {
            await message.delete().catch(() => {});
        }

        const sessionChannelId = "1556685797703553144";
        const serverKey = client.config?.prcKey;
        const apiBaseUrl = "https://api.erlc.gg/v2";
        const refreshInterval = 30_000;

        const bannerUrl =
            "https://cdn.discordapp.com/attachments/1562258264882806814/1562604852763426987/336A9E81-9370-4B7C-8DDF-79658B2B20F9.png";

        if (!serverKey) {
            console.error("ER:LC API key is missing. Check config.js.");
            return;
        }

        const channel = await client.channels
            .fetch(sessionChannelId)
            .catch(() => null);

        if (!channel || !channel.isTextBased() || !channel.guild) {
            console.error("The session panel channel could not be found.");
            return;
        }

        if (client.sessionPanelInterval) {
            clearInterval(client.sessionPanelInterval);
            client.sessionPanelInterval = null;
        }

        if (!client.sessionStatus) {
            client.sessionStatus = "offline";
        }

        const fetchServerData = async () => {
            const response = await axios.get(`${apiBaseUrl}/server`, {
                params: {
                    Players: true,
                    Staff: true,
                    Queue: true
                },
                headers: {
                    "Server-Key": serverKey
                },
                timeout: 15000
            });

            const data = response.data;
            const players = Array.isArray(data?.Players)
                ? data.Players
                : [];

            const queue = Array.isArray(data?.Queue)
                ? data.Queue
                : [];

            const staffPermissions = new Set([
                "moderator",
                "mod",
                "server moderator",
                "admin",
                "administrator",
                "server administrator",
                "co-owner",
                "coowner",
                "owner",
                "server owner"
            ]);

            const staffCount = players.filter(player => {
                const permission = String(
                    player?.Permission ??
                    player?.permission ??
                    player?.Permissions ??
                    player?.permissions ??
                    ""
                )
                    .trim()
                    .toLowerCase()
                    .replace(/\s+/g, " ");

                return staffPermissions.has(permission);
            }).length;

            return {
                players,
                queue,
                staffCount,
                maxPlayers:
                    data?.MaxPlayers ??
                    data?.["Max Players"] ??
                    data?.maxPlayers ??
                    null
            };
        };

        const buildPanel = (serverData) => {
            const { players, queue, staffCount, maxPlayers } = serverData;
            const online = client.sessionStatus === "online";

            const playerCount = maxPlayers
                ? `${players.length} / ${maxPlayers}`
                : `${players.length}`;

            const nextUpdate = Math.floor(
                (Date.now() + refreshInterval) / 1000
            );

            const container = new ContainerBuilder()
                .setAccentColor(0x37373E);

            container.addMediaGalleryComponents(
                new MediaGalleryBuilder().addItems(
                    new MediaGalleryItemBuilder()
                        .setURL(bannerUrl)
                        .setDescription("Orlando State Roleplay banner")
                )
            );

            container.addSeparatorComponents(new SeparatorBuilder());

            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    "# Session Start Times\n\n" +
                    "> **Weekday Time:** <t:1792764000:t>\n" +
                    "> **Weekend Time:** <t:1792738800:t>\n\n" +
                    "# Server Information\n\n" +
                    "> **Server Name:** Orlando State Roleplay\n" +
                    "> **Server Owner:** Ykaldjane2319\n" +
                    "> **Join Code:** OSRPPP\n\n" +
                    "> Do not attempt to join the server when it is shut down.\n" +
                    "> Use the Join Server button below to try to connect.\n" +
                    "> Click 🔔 to receive the session ping role!"
                )
            );

            container.addSeparatorComponents(new SeparatorBuilder());

            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    "## Live In-game Server Stats"
                )
            );

            container.addSeparatorComponents(new SeparatorBuilder());

            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `**Players**\n\`${playerCount}\``
                )
            );

            container.addSeparatorComponents(new SeparatorBuilder());

            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `**Staff Count**\n\`${staffCount}\``
                )
            );

            container.addSeparatorComponents(new SeparatorBuilder());

            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `**In-game Queue**\n\`${queue.length}\``
                )
            );

            container.addSeparatorComponents(new SeparatorBuilder());

            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `**Next Update**\n<t:${nextUpdate}:R>\n` +
                    "*In-game stats refresh automatically every 30 seconds.*"
                )
            );

            const statusButton = new ButtonBuilder()
                .setCustomId("session-status")
                .setLabel(online ? "Server Online" : "Server Offline")
                .setStyle(online ? ButtonStyle.Success : ButtonStyle.Danger)
                .setDisabled(true);

            const notificationButton = new ButtonBuilder()
                .setCustomId("sessionsRole:button")
                .setEmoji("🔔")
                .setStyle(ButtonStyle.Secondary);

            const joinButton = new ButtonBuilder()
                .setLabel("Quick Join")
                .setStyle(ButtonStyle.Link)
                .setURL("https://erlc.gg/join?code=OSRPPP");

            container.addActionRowComponents(
                new ActionRowBuilder().addComponents(
                    statusButton,
                    notificationButton,
                    joinButton
                )
            );

            return {
                components: [container],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: {
                    parse: []
                }
            };
        };

        const refreshPanel = async () => {
            if (!client.sessionPanelMessage) return;

            const serverData = await fetchServerData();

            await client.sessionPanelMessage.edit(
                buildPanel(serverData)
            );
        };

        try {
            const savedSession = await SessionsModel.findOne({
                channelId: sessionChannelId
            });

            if (savedSession?.messageId) {
                client.sessionPanelMessage = await channel.messages
                    .fetch(savedSession.messageId)
                    .catch(() => null);
            }

            const initialData = await fetchServerData();

            if (client.sessionPanelMessage) {
                await client.sessionPanelMessage.edit(
                    buildPanel(initialData)
                );
            } else {
                client.sessionPanelMessage = await channel.send(
                    buildPanel(initialData)
                );
            }

            client.sessionPanelChannelId = sessionChannelId;

            await SessionsModel.findOneAndUpdate(
                {
                    channelId: sessionChannelId
                },
                {
                    channelId: sessionChannelId,
                    messageId: client.sessionPanelMessage.id
                },
                {
                    upsert: true,
                    returnDocument: "after",
                    setDefaultsOnInsert: true
                }
            );

            client.refreshSessionPanel = async () => {
                try {
                    await refreshPanel();
                } catch (error) {
                    console.error(
                        "Failed to refresh session panel:",
                        error.response?.data || error.message || error
                    );
                }
            };

            let isRefreshing = false;

            client.sessionPanelInterval = setInterval(async () => {
                if (isRefreshing) return;

                isRefreshing = true;

                try {
                    await refreshPanel();
                } catch (error) {
                    console.error(
                        "Session panel refresh failed:",
                        error.response?.data || error.message || error
                    );
                } finally {
                    isRefreshing = false;
                }
            }, refreshInterval);

            console.log(
                "Session panel restored or saved and updater started."
            );
        } catch (error) {
            console.error("Error initializing the session panel:");
            console.dir(error, { depth: null });
        }
    }
};
