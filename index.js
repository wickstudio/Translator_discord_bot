const Discord = require('discord.js');
const translate = require('google-translate-api-browser').default;
const sqlite3 = require('sqlite3').verbose();

const PREFIX  = '!'; // your prefix

const client = new Discord.Client({
  intents: [Discord.Intents.FLAGS.GUILDS, Discord.Intents.FLAGS.GUILD_MESSAGES]
});

let db = new sqlite3.Database('./translation_channels.db', sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to the database.');
    db.run(`
      CREATE TABLE IF NOT EXISTS channels (
        guild_id TEXT PRIMARY KEY,
        channel_id TEXT NOT NULL
      )
    `);
  }
});

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
  console.error(`Code by 约 - Wick `);
});

async function translateMessage(content, toLang) {
  try {
    const translation = await translate(content, { to: toLang });
    return translation.text;
  } catch (error) {
    console.error('Error while translating:', error);
    return 'Error occurred while translating the message.';
  }
}

function handlePingCommand(message) {
  const ping = Date.now() - message.createdTimestamp;
  message.channel.send(`Your bot's ping is : ${ping}ms.`);
}

async function handleSetChannelCommand(message) {
  if (message.guild.ownerId === message.author.id || message.member.permissions.has('ADMINISTRATOR')) {
    message.channel.send('Please send channel ID where you want to enable auto-translation.');

    const filter = m => m.author.id === message.author.id;
    try {
      const collected = await message.channel.awaitMessages({
        filter,
        max: 1,
        time: 60000,
        errors: ['time']
      });

      const msg = collected.first();
      const newChannelId = msg.content.trim();
      const channel = message.guild.channels.cache.get(newChannelId);

      if (!channel) {
        message.channel.send('Invalid channel ID. Please try again with a valid channel ID.');
        return;
      }

      db.run('INSERT OR REPLACE INTO channels (guild_id, channel_id) VALUES (?, ?)', [message.guild.id, newChannelId], (err) => {
        if (err) {
          console.error('Error saving channel ID:', err);
          message.channel.send('error, Please try again later.');
        } else {
          message.channel.send('Translation channel updated successfully!');
          updateFooterMessage(newChannelId, message.author.username); 
        }
      });
    } catch (error) {
      console.error('Error while awaiting messages:', error);
      message.channel.send('error, Please try again later.');
    }
  } else {
    message.channel.send('Only administrators can change the translation channel.');
  }
}

async function handleChangeChannelCommand(message) {
  if (message.guild.ownerId === message.author.id || message.member.permissions.has('ADMINISTRATOR')) {
    message.channel.send('Please send new channel ID where you want to enable auto-translation.');

    const filter = m => m.author.id === message.author.id;
    try {
      const collected = await message.channel.awaitMessages({
        filter,
        max: 1,
        time: 60000,
        errors: ['time']
      });

      const msg = collected.first();
      const newChannelId = msg.content.trim();
      const channel = message.guild.channels.cache.get(newChannelId);

      if (!channel) {
        message.channel.send('Invalid channel ID. Please try again with a valid channel ID.');
        return;
      }

      db.run('INSERT OR REPLACE INTO channels (guild_id, channel_id) VALUES (?, ?)', [message.guild.id, newChannelId], (err) => {
        if (err) {
          console.error('Error saving channel ID:', err);
          message.channel.send('An error occurred while saving the channel ID. Please try again later.');
        } else {
          message.channel.send('Translation channel updated successfully!');
          updateFooterMessage(newChannelId, message.author.username); 
        }
      });
    } catch (error) {
      console.error('Error while awaiting messages:', error);
      message.channel.send('error, Please try again later.');
    }
  } else {
    message.channel.send('Only administrators can change the translation channel.');
  }
}

function handleHelpCommand(message) {
  const prefix = PREFIX;

  const commands = {
    setchannel: {
      description: 'Set the channel for auto-translation',
      usage: `${prefix}setchannel`
    },
    changechannel: {
      description: 'Change the translation channel',
      usage: `${prefix}changechannel`
    },
    ping: {
      description: 'Check the bot\'s Ping',
      usage: `${prefix}ping`
    },
    help: {
      description: 'List of commands',
      usage: `${prefix}help`
    }
  };

  const embed = new Discord.MessageEmbed()
    .setColor('#00ff00')
    .setTitle('Bot Commands');

  for (const commandName in commands) {
    const command = commands[commandName];
    embed.addField(command.usage, command.description);
  }

  message.channel.send({ embeds: [embed] });
}

function updateFooterMessage(channelId, username) {
  const guild = client.guilds.cache.get(channelId);
  if (guild) {
    const channel = guild.channels.cache.get(channelId);
    if (channel && channel.isText()) {
      channel.messages.fetch({ limit: 1 }).then(messages => {
        const lastMessage = messages.first();
        if (lastMessage && lastMessage.embeds.length > 0) {
          const embed = lastMessage.embeds[0];
          embed.setFooter(`Message by ${username}`, embed.footer.iconURL);
          lastMessage.edit({ embeds: [embed] }).catch(error => {
            console.error('Error updating footer message:', error);
          });
        }
      }).catch(error => {
        console.error('Error fetching messages:', error);
      });
    }
  }
}

function handleOtherCommand(message) {
}

async function handleCommand(message) {
  const prefix = PREFIX;
  const content = message.content.trim();

  if (content === prefix + 'ping') {
    handlePingCommand(message);
  } else if (content.startsWith(prefix + 'setchannel')) {
    await handleSetChannelCommand(message);
  } else if (content.startsWith(prefix + 'changechannel')) {
    await handleChangeChannelCommand(message);
  } else if (content.startsWith(prefix + 'help')) {
    handleHelpCommand(message);
  } else {
    handleOtherCommand(message);
  }
}

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const prefix = PREFIX;
  if (message.content.startsWith(prefix)) {
    handleCommand(message);
    return;
  }

  
  const channelId = await getTranslationChannelId(message.guild.id);
  if (channelId && message.channel.id === channelId) {
  
    const content = message.content;
    const translatedMessage = await translateMessage(content, 'ar');
    const embed = new Discord.MessageEmbed()
      .setColor('#00ff00')
      .setTitle('Message Translation')
      .addField('Message :', content)
      .addField('Translated (Arabic) :', translatedMessage)
      .setFooter(`Message by ${message.author.username}`, message.author.displayAvatarURL());

    message.channel.send({ embeds: [embed] });
  }
});


function getTranslationChannelId(guildId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT channel_id FROM channels WHERE guild_id = ?', [guildId], (err, row) => {
      if (err) {
        console.error('Error retrieving channel ID:', err);
        reject(err);
      } else {
        resolve(row?.channel_id);
      }
    });
  });
}

// bot token
client.login('Your_Token_Here');
