require('dotenv').config();

const fs = require('fs');
const path = require('path');
 
const {
  REST,
  Routes,
} = require('discord.js');

const commands = [];

const commandsPath = path.join(__dirname, 'commands');

const commandFiles = fs
  .readdirSync(commandsPath)
  .filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);

  if (!command.data) {
    console.warn(` WARNING / ${file} is missing "data".`);
    continue;
  }
 
  commands.push(command.data.toJSON());

  console.log(`Started registering /${command.data.name}`);
}

const rest = new REST({ version: '10' })
  .setToken(process.env.TOKEN);

(async () => {
  try {
    console.log(`Started refreshing ${commands.length} application command(s).`);

    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      {
        body: commands,
      }
    );

    console.log(`Successfully registered ${commands.length} command(s).`);
  } catch (error) {
    console.error(error);
  }
})();
