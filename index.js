const dns = require('node:dns');

dns.setServers(['8.8.8.8', '1.1.1.1']);

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const http = require('node:http');
const mongoose = require('mongoose');

const {
    Client,
    Collection,
    GatewayIntentBits,
    MessageFlags,
} = require('discord.js');

const PORT = Number(process.env.PORT) || 3000;

// ==========================================
// RENDER HTTP SERVER
// ==========================================

const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/health') {
        res.writeHead(200, {
            'Content-Type': 'text/plain',
        });

        res.end('Orlando State Roleplay bot is running.');
        return;
    }

    res.writeHead(404, {
        'Content-Type': 'text/plain',
    });

    res.end('Not found.');
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`HTTP server listening on port ${PORT}.`);
});

server.on('error', error => {
    console.error('HTTP server error:', error);
});

// ==========================================
// DISCORD CLIENT
// ==========================================

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
} else {
    console.warn('Messages folder not found.');
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
} else {
    console.warn('Event folder not found.');
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
// Supports both commands/ and Commands/
// ==========================================

const commandDirectories = ['commands', 'Commands'];
const loadedCommandFiles = new Set();

for (const directory of commandDirectories) {
    const commandsPath = path.join(__dirname, directory);

    if (!fs.existsSync(commandsPath)) continue;

    for (const file of fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'))) {
        const filePath = path.join(commandsPath, file);

        if (loadedCommandFiles.has(filePath)) continue;
        loadedCommandFiles.add(filePath);

        try {
            const command = require(filePath);

            if (!command.data || typeof command.execute !== 'function') {
                console.warn(`Skipped ${directory}/${file}: missing data or execute.`);
                continue;
            }

            const commandName = command.data.name;

            if (client.commands.has(commandName)) {
                console.warn(
                    `Duplicate slash command /${commandName} found in ${directory}/${file}. Skipping duplicate.`
                );
                continue;
            }

            client.commands.set(commandName, command);
            console.log(`Loaded slash command: /${commandName}`);
        } catch (error) {
            console.error(`Failed to load ${directory}/${file}:`, error);
        }
    }
}

if (client.commands.size === 0) {
    console.warn('No slash commands were loaded. Check your command folders.');
}

// ==========================================
// LOAD BUTTON HANDLERS
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
    if (interaction.isChatInputCommand()) {
        console.log(
            `[INTERACTION] Received /${interaction.commandName}`
        );

        const command = client.commands.get(interaction.commandName);

        if (!command) {
            console.error(
                `[INTERACTION] Command not loaded: /${interaction.commandName}`
            );

            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: 'This command is not loaded by the bot.',
                    flags: MessageFlags.Ephemeral,
                }).catch(error => {
                    console.error('Failed to report missing command:', error);
                });
            }

            return;
        }

        try {
            console.log(
                `[INTERACTION] Executing /${interaction.commandName}`
            );

            await command.execute(interaction, client);

            console.log(
                `[INTERACTION] Finished /${interaction.commandName}`
            );
        } catch (error) {
            console.error(
                `[INTERACTION] Failed /${interaction.commandName}:`,
                error
            );

            const reply = {
                content: 'There was an error running this command. Check the bot logs.',
                flags: MessageFlags.Ephemeral,
            };

            if (interaction.deferred || interaction.replied) {
                await interaction.followUp(reply).catch(followUpError => {
                    console.error('Failed to send interaction error:', followUpError);
                });
            } else {
                await interaction.reply(reply).catch(replyError => {
                    console.error('Failed to acknowledge interaction:', replyError);
                });
            }
        }

        return;
    }

    if (interaction.isButton()) {
        const customId = interaction.customId;

        let handler = client.buttonHandlers.get(customId);
        let args = [];

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
            console.warn(`[BUTTON] No handler found for: ${customId}`);

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
            console.error(`[BUTTON] Error handling ${customId}:`, error);

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
        console.error('Missing MONGO_URI in your environment variables.');
        process.exit(1);
    }

    if (!process.env.TOKEN) {
        console.error('Missing TOKEN in your environment variables.');
        process.exit(1);
    }

    try {
        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 15000,
        });

        console.log('MongoDB connection established.');

        await client.login(process.env.TOKEN);
    } catch (error) {
        console.error('Failed to start the bot:', error);
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
