const SessionsModel = require('../Models/SessionsModel');

module.exports = {
    name: 'clientReady',
    once: true,

    async execute(client) {
        try {
            const session = await SessionsModel.findOne();

            if (!session) {
                console.log(
                    'No saved session panel found in MongoDB. Run -embed to create one.'
                );
                return;
            }

            const channel = await client.channels
                .fetch(session.channelId)
                .catch(() => null);

            if (!channel || !channel.isTextBased()) {
                console.warn('Saved session panel channel could not be found.');
                return;
            }

            const panelMessage = await channel.messages
                .fetch(session.messageId)
                .catch(() => null);

            if (!panelMessage) {
                console.warn(
                    'Saved panel message could not be found. Run -embed to create a new one.'
                );
                return;
            }

            client.sessionPanelMessage = panelMessage;
            client.sessionPanelChannelId = session.channelId;

            console.log('Saved session panel restored successfully.');

            // Initialize the panel updater after restoring the message.
            const embedCommand = client.prefixCommands.get('embed');

            if (embedCommand) {
                await embedCommand.run(client, {
                    delete: async () => {},
                    channel
                }, []);
            }
        } catch (error) {
            console.error('Failed to restore the session panel:', error);
        }
    }
};
