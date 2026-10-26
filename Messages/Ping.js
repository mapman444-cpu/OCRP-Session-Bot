const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'ping',
    description: 'Check bot and database connection status.',

    run: async (client, message) => {
        const sent = await message.reply('Pinging...');

        const botLatency = sent.createdTimestamp - message.createdTimestamp;
        const apiLatency = Math.round(client.ws.ping);

        let mongoStatus = 'Disconnected';

        try {
            const mongoose = require('mongoose');

            if (mongoose.connection.readyState === 1) {
                mongoStatus = 'Connected';
            } else if (mongoose.connection.readyState === 2) {
                mongoStatus = 'Connecting';
            }
        } catch {
            mongoStatus = 'Not configured';
        }

        const embed = new EmbedBuilder()
            .setTitle('Pong!')
            .setDescription(
                `**Bot Latency:** ${botLatency}ms\n` +
                `**API Latency:** ${apiLatency}ms\n` +
                `**MongoDB Connection:** ${mongoStatus}`
            )
            .setFooter({ text: 'Connection Status' });

        await sent.edit({
            content: '',
            embeds: [embed]
        });
    }
};
