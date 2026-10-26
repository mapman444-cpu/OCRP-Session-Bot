const {
    ContainerBuilder,
    TextDisplayBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    SeparatorBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
} = require("discord.js");

const axios = require("axios");
const SessionsModel = require("../Models/SessionsModel");

const SESSION_CHANNEL_ID = "1556685797703553144";
const NOTIFICATION_ROLE_ID = "1556729983546957875";
const API_BASE_URL = "https://api.erlc.gg/v2";
const REFRESH_INTERVAL = 30_000;

const BANNER_URL =
    "https://cdn.discordapp.com/attachments/1562258264882806814/1562604852763426987/336A9E81-9370-4B7C-8DDF-79658B2B20F9.png";

const JOIN_URL = "https://erlc.gg/join?code=OSRPPP";

const STAFF_PERMISSIONS = new Set([
    "moderator",
    "mod",
    "admin",
    "administrator",
    "co-owner",
    "coowner",
    "owner",
]);

// ==========================================
// FETCH ER:LC SERVER DATA
// ==========================================

async function fetchServerData(client) {
    const serverKey = client.config?.prcKey;

    if (!serverKey) {
        throw new Error(
            "ER:LC API key is missing. Check config.js and PRC_KEY."
        );
    }

    const response = await axios.get(`${API_BASE_URL}/server`, {
        params: {
            Players: true,
            Staff: true,
            Queue: true,
        },
        headers: {
            "Server-Key": serverKey,
        },
        timeout: 15000,
    });

    const data = response.data;

    const players = Array.isArray(data?.Players)
        ? data.Players
        : [];

    const queue = Array.isArray(data?.Queue)
        ? data.Queue
        : [];

    const staffCount = players.filter(player => {
        const permission = String(
            player?.Permission ??
            player?.permission ??
            player?.Permissions ??
            player?.permissions ??
            ""
        ).trim().toLowerCase();

        return STAFF_PERMISSIONS.has(permission);
    }).length;

    return {
        players,
        queue,
        staffCount,
        maxPlayers:
            data?.MaxPlayers ??
            data?.["Max Players"] ??
            data?.maxPlayers ??
            null,
    };
}

// ==========================================
// BUILD SESSION PANEL
// ==========================================

function buildPanel(client, serverData) {
    const { players, queue, staffCount, maxPlayers } = serverData;
    const online = client.sessionStatus === "online";

    const playerCount = maxPlayers
        ? `${players.length} / ${maxPlayers}`
        : `${players.length}`;

    const nextUpdate = Math.floor(
        (Date.now() + REFRESH_INTERVAL) / 1000
    );

    const container = new ContainerBuilder()
        .setAccentColor(0x37373E);

    container.addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(
            new MediaGalleryItemBuilder()
                .setURL(BANNER_URL)
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
            "> Use the Quick Join button below to try to connect.\n" +
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
        .setURL(JOIN_URL);

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
            parse: [],
        },
    };
}

// ==========================================
// RESTORE AND START AUTO-REFRESH
// ==========================================

async function initialize(client) {
    if (client.sessionPanelInitializing) {
        return client.sessionPanelInitializing;
    }

    client.sessionPanelInitializing = (async () => {
        const channel = await client.channels
            .fetch(SESSION_CHANNEL_ID)
            .catch(error => {
                console.error(
                    "Could not fetch the session panel channel:",
                    error.message
                );
                return null;
            });

        if (!channel || !channel.isTextBased() || !channel.messages) {
            throw new Error(
                `Session panel channel ${SESSION_CHANNEL_ID} is unavailable.`
            );
        }

        // Stop any previous timer before starting another.
        if (client.sessionPanelInterval) {
            clearInterval(client.sessionPanelInterval);
            client.sessionPanelInterval = null;
        }

        if (!client.sessionStatus) {
            client.sessionStatus = "offline";
        }

        // Restore the existing panel using its saved MongoDB message ID.
        const savedSession = await SessionsModel.findOne({
            channelId: SESSION_CHANNEL_ID,
        }).lean();

        let panelMessage = null;

        if (savedSession?.messageId) {
            panelMessage = await channel.messages
                .fetch(savedSession.messageId)
                .catch(error => {
                    console.warn(
                        "Could not fetch the saved session panel:",
                        error.message
                    );
                    return null;
                });
        }

        // Fetch fresh data before editing or creating a panel.
        const initialData = await fetchServerData(client);
        const panelPayload = buildPanel(client, initialData);

        if (panelMessage) {
            await panelMessage.edit(panelPayload);
            console.log("Existing session panel restored and updated.");
        } else {
            panelMessage = await channel.send(panelPayload);

            await SessionsModel.findOneAndUpdate(
                { channelId: SESSION_CHANNEL_ID },
                {
                    $set: {
                        channelId: SESSION_CHANNEL_ID,
                        messageId: panelMessage.id,
                    },
                },
                {
                    upsert: true,
                    returnDocument: "after",
                    setDefaultsOnInsert: true,
                }
            );

            console.log(
                `Session panel created and saved: ${panelMessage.id}`
            );
        }

        client.sessionPanelMessage = panelMessage;
        client.sessionPanelChannelId = SESSION_CHANNEL_ID;

        // One shared refresh function for the timer and shutdown command.
        client.refreshSessionPanel = async () => {
            if (!client.sessionPanelMessage) {
                throw new Error(
                    "The session panel message has not been restored."
                );
            }

            const serverData = await fetchServerData(client);

            await client.sessionPanelMessage.edit(
                buildPanel(client, serverData)
            );

            console.log("Session panel refreshed successfully.");
        };

        let isRefreshing = false;

        client.sessionPanelInterval = setInterval(async () => {
            if (isRefreshing) return;

            isRefreshing = true;

            try {
                await client.refreshSessionPanel();
            } catch (error) {
                console.error(
                    "Session panel auto-refresh failed:",
                    error.response?.data || error.message || error
                );
            } finally {
                isRefreshing = false;
            }
        }, REFRESH_INTERVAL);

        console.log(
            "Session panel auto-refresh started (every 30 seconds)."
        );
    })();

    try {
        return await client.sessionPanelInitializing;
    } finally {
        client.sessionPanelInitializing = null;
    }
}

// ==========================================
// PREFIX COMMAND
// ==========================================

module.exports = {
    name: "embed",
    description: "Send and update the session status panel.",

    initialize,

    run: async (client, message) => {
        if (message?.delete) {
            await message.delete().catch(() => {});
        }

        try {
            await initialize(client);
        } catch (error) {
            console.error(
                "Failed to initialize the session panel:",
                error.response?.data || error.message || error
            );
        }
    },
};
