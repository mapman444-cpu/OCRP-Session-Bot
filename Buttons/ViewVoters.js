module.exports = {
    customID: "viewvote:button",
   
    execute: async function (interaction, client, args) {
      const sessionId = args[0];
      const sessionVotes = client.voteMap?.get(sessionId) || new Map();
 
      let voterMentions = [];

      if ([...sessionVotes.keys()].every((k) => typeof k === "string")) {
        voterMentions = [...sessionVotes.keys()].map((id) => `<@${id}>`);
      } else {
        for (const value of sessionVotes.values()) {
          if (value && typeof value === "object" && value.user && value.user.id) {
            voterMentions.push(`<@${value.user.id}>`);
          } else if (typeof value === "string") {
            voterMentions.push(`<@${value}>`);
          }
        }
      }
  
      const content =
        voterMentions.length > 0 ? voterMentions.join("\n") : "No votes yet.";
  
      const requiredVotes = 15; // change this to your required vote count
      await interaction.reply({
        content: `**Voters List (\`${sessionVotes.size}/${requiredVotes}\`)**:\n${content}`,
        ephemeral: true,
      });
    },
  };
  