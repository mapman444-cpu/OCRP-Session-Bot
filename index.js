
const dns = require('node:dns');

dns.setServers(['8.8.8.8', '1.1.1.1']);

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
client.config = require('./config.js');

const {
    Client,
    Collection,
    GatewayIntentBits,
    MessageFlags,
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
});

client.commands = new Collection();
client.prefixCommands = new Collection();
client.buttonHandlers = new Collection();
client.config = require('./config.js');

client.voteMap = new Map();
client.completedPolls = new Set();
client.activePollId = null;

const PREFIX = '-';

// ==========================================
// LOAD PREFIX COMMANDS
// ==========================================

const messagesPath = path.join(__dirname, 'Messages');

if (fs.existsSync(messagesPath)) {
    for (const file of fs.readdirSync(messagesPath).filter(file => file.endsWith('.js'))) {
        try {
            const command = require(path.join(messagesPath, file));

            if (!command.name || typeof command.run !== 'function') {
                console.warn(`Skipped Messages/${file}: missing name or run.`);
                continue;
            }

            client.prefixCommands.set(command.name.toLowerCase(), command);
            console.log(`Loaded prefix command: ${PREFIX}${command.name}`);
        } catch (error) {
            console.error(`Failed to load Messages/${file}:`, error);
        }
    }
}

// ==========================================
// LOAD EVENT HANDLERS
// ==========================================

const eventsPath = path.join(__dirname, 'Event');

if (fs.existsSync(eventsPath)) {
    for (const file of fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'))) {
        try {
            const event = require(path.join(eventsPath, file));

            if (!event.name || typeof event.execute !== 'function') {
                console.warn(`Skipped Event/${file}: expected name and execute.`);
                continue;
            }

            const handler = (...args) => event.execute(...args, client);

            if (event.once) {
                client.once(event.name, handler);
            } else {
                client.on(event.name, handler);
            }

            console.log(`Loaded event: ${event.name}`);
        } catch (error) {
            console.error(`Failed to load Event/${file}:`, error);
        }
    }
}

// ==========================================
// PREFIX COMMAND HANDLER
// ==========================================

client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const commandName = args.shift()?.toLowerCase();

    if (!commandName) return;

    const command = client.prefixCommands.get(commandName);
    if (!command) return;

    try {
        await command.run(client, message, args);
    } catch (error) {
        console.error(`Error executing ${PREFIX}${commandName}:`, error);

        await message.reply(
            'There was an error running this command.'
        ).catch(() => {});
    }
});

// ==========================================
// LOAD SLASH COMMANDS
// ==========================================

const commandsPath = path.join(__dirname, 'commands');

if (fs.existsSync(commandsPath)) {
    for (const file of fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'))) {
        try {
            const command = require(path.join(commandsPath, file));

            if (!command.data || typeof command.execute !== 'function') {
                console.warn(`Skipped commands/${file}: missing data or execute.`);
                continue;
            }

            client.commands.set(command.data.name, command);
            console.log(`Loaded slash command: /${command.data.name}`);
        } catch (error) {
            console.error(`Failed to load commands/${file}:`, error);
        }
    }
}

// ==========================================
// LOAD BUTTON HANDLERS
// Place Vote.js, ViewVoters.js and SessionRole.js
// inside the Buttons folder.
// ==========================================

const buttonsPath = path.join(__dirname, 'Buttons');

if (fs.existsSync(buttonsPath)) {
    for (const file of fs.readdirSync(buttonsPath).filter(file => file.endsWith('.js'))) {
        try {
            const button = require(path.join(buttonsPath, file));

            if (!button.customID || typeof button.execute !== 'function') {
                console.warn(
                    `Skipped Buttons/${file}: missing customID or execute.`
                );
                continue;
            }

            client.buttonHandlers.set(button.customID, button);

            console.log(`Loaded button handler: ${button.customID}`);
        } catch (error) {
            console.error(`Failed to load Buttons/${file}:`, error);
        }
    }
} else {
    console.warn(
        'Buttons folder not found. Create Buttons/ and put your button handler files inside it.'
    );
}

// ==========================================
// INTERACTION HANDLER
// ==========================================

client.on('interactionCreate', async interaction => {

    // --------------------------------------
    // SLASH COMMANDS
    // --------------------------------------

    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);

        if (!command) return;

        try {
            await command.execute(interaction, client);
        } catch (error) {
            console.error(
                `Error executing /${interaction.commandName}:`,
                error
            );

            const reply = {
                content: 'There was an error running this command.'
            };

            if (interaction.deferred || interaction.replied) {
                await interaction.followUp(reply).catch(() => {});
            } else {
                await interaction.reply({
                    ...reply,
                    flags: MessageFlags.Ephemeral,
                }).catch(() => {});
            }
        }

        return;
    }

    // --------------------------------------
    // BUTTONS
    // --------------------------------------

    if (interaction.isButton()) {
        const customId = interaction.customId;

        let handler = client.buttonHandlers.get(customId);
        let args = [];

        // Match IDs such as:
        // vote:button_12345
        // viewvote:button_12345

        if (!handler) {
            const separator = customId.lastIndexOf('_');

            if (separator !== -1) {
                const baseId = customId.slice(0, separator);
                const sessionId = customId.slice(separator + 1);

                handler = client.buttonHandlers.get(baseId);

                if (handler) {
                    args = [sessionId];
                }
            }
        }

        if (!handler) {
            console.warn(`No button handler found for: ${customId}`);

            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: 'This button is not configured correctly.',
                    flags: MessageFlags.Ephemeral,
                }).catch(() => {});
            }

            return;
        }

        try {
            await handler.execute(interaction, client, args);
        } catch (error) {
            console.error(
                `Error handling button ${customId}:`,
                error
            );

            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: 'There was an error processing this button.',
                    flags: MessageFlags.Ephemeral,
                }).catch(() => {});
            } else if (interaction.deferred) {
                await interaction.editReply({
                    content: 'There was an error processing this button.',
                }).catch(() => {});
            }
        }

        return;
    }
});

// ==========================================
// MONGODB EVENTS
// ==========================================

mongoose.connection.on('connected', () => {
    console.log('Connected to MongoDB.');
});

mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected.');
});

mongoose.connection.on('error', error => {
    console.error('MongoDB connection error:', error.message);
});

// ==========================================
// DISCORD CLIENT ERRORS
// ==========================================

client.on('error', error => {
    console.error('Discord client error:', error);
});

// ==========================================
// START BOT
// ==========================================

async function startBot() {
    if (!process.env.MONGO_URI) {
        console.error('Missing MONGO_URI in your .env file.');
        process.exit(1);
    }

    if (!process.env.TOKEN) {
        console.error('Missing TOKEN in your .env file.');
        process.exit(1);
    }

    try {
        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 15000,
        });

        console.log('MongoDB connection established.');

        await client.login(process.env.TOKEN);
    } catch (error) {
        console.error('Failed to start the bot:', error.message);
        process.exit(1);
    }
}

// ==========================================
// BOT READY
// ==========================================

client.once('clientReady', () => {
    console.log(`Logged in as ${client.user.tag}`);
    console.log(`Loaded ${client.prefixCommands.size} prefix command(s).`);
    console.log(`Loaded ${client.commands.size} slash command(s).`);
    console.log(`Loaded ${client.buttonHandlers.size} button handler(s).`);
});

startBot();
