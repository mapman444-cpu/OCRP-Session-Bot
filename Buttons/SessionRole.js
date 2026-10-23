const roleId = "1556729983546957875"; // role id

const cooldowns = new Map();
 
module.exports = {
  customID: "sessionsRole:button", 
  async execute(interaction) {
    const userId = interaction.user.id;
    const now = Date.now();
    const cooldownTime = 5000;

    if (cooldowns.has(userId)) {
      const expiresAt = cooldowns.get(userId);
      if (now < expiresAt) {
        const relative = `<t:${Math.floor(expiresAt / 1000)}:R>`;
        return interaction.reply({
          content: `You are on **cooldown**, please try again in ${relative}.`,
          ephemeral: true,
        });
      }
    }

    cooldowns.set(userId, now + cooldownTime);
    setTimeout(() => cooldowns.delete(userId), cooldownTime);

    const role = await interaction.guild.roles.fetch(roleId);
    if (!role) {
      return await interaction.reply({
        content: "**Sessions role** not found!",
        ephemeral: true,
      });
    }

    const member = interaction.member;
    const username = member.user.username;

    if (member.roles.cache.has(roleId)) {
      await member.roles.remove(role);
      await interaction.reply({
        content: `You no longer have the sessions notification role. You will no longer be notified for sessions.`,
        ephemeral: true,
      });
    } else {
      await member.roles.add(role);
      await interaction.reply({
        content: `You now have the sessions notification role. You will be notified for sessions.`,
        ephemeral: true,
      });
    }
  },
};
