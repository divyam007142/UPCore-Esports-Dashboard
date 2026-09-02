# Member stats API for the UPCore bot

The dashboard's `/stats` page reads:

```text
GET /api/members/activity
```

The public API already has a working health route. These changes add the data needed for total members, online members, current voice members, message counts, and voice time.

## 1. Add the activity model

Create:

```text
bot/src/models/MemberActivity.js
```

Paste:

```js
const mongoose = require('mongoose');

const memberActivitySchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  userTag: { type: String, default: '' },
  displayName: { type: String, default: '' },
  messageCount: { type: Number, default: 0 },
  voiceTimeSeconds: { type: Number, default: 0 },
  currentVoiceSessionStartedAt: { type: Date, default: null },
  currentVoiceChannelName: { type: String, default: null },
  lastMessageAt: { type: Date, default: null },
  lastSeenAt: { type: Date, default: null }
}, { timestamps: true });

memberActivitySchema.index(
  { guildId: 1, userId: 1 },
  { unique: true }
);

module.exports = mongoose.model(
  'MemberActivity',
  memberActivitySchema
);
```

## 2. Add the activity service

Create:

```text
bot/src/services/memberActivityService.js
```

Paste:

```js
const MemberActivity = require('../models/MemberActivity');

function memberFields(data) {
  return {
    userTag: data.userTag || '',
    displayName: data.displayName || data.userTag || '',
    lastSeenAt: new Date()
  };
}

async function recordMessage(message) {
  if (!message.guild || !message.author || message.author.bot) {
    return;
  }

  await MemberActivity.findOneAndUpdate(
    {
      guildId: message.guild.id,
      userId: message.author.id
    },
    {
      $set: {
        ...memberFields({
          userTag: message.author.tag,
          displayName: message.member?.displayName ||
            message.author.username
        }),
        lastMessageAt: new Date()
      },
      $inc: {
        messageCount: 1
      }
    },
    {
      upsert: true,
      setDefaultsOnInsert: true
    }
  );
}

async function startVoiceSession({
  guildId,
  userId,
  userTag,
  displayName,
  channelName
}) {
  await MemberActivity.findOneAndUpdate(
    {
      guildId,
      userId
    },
    {
      $set: {
        ...memberFields({ userTag, displayName }),
        currentVoiceSessionStartedAt: new Date(),
        currentVoiceChannelName: channelName || null
      }
    },
    {
      upsert: true,
      setDefaultsOnInsert: true
    }
  );
}

async function finishVoiceSession({
  guildId,
  userId,
  userTag,
  displayName
}) {
  const activity = await MemberActivity.findOne({
    guildId,
    userId
  });

  if (!activity) {
    return 0;
  }

  const startedAt = activity.currentVoiceSessionStartedAt;
  const durationSeconds = startedAt
    ? Math.max(
        0,
        Math.floor((Date.now() - startedAt.getTime()) / 1000)
      )
    : 0;

  await MemberActivity.updateOne(
    {
      _id: activity._id,
      currentVoiceSessionStartedAt: { $ne: null }
    },
    {
      $set: {
        ...memberFields({ userTag, displayName }),
        currentVoiceSessionStartedAt: null,
        currentVoiceChannelName: null
      },
      $inc: {
        voiceTimeSeconds: durationSeconds
      }
    }
  );

  return durationSeconds;
}

module.exports = {
  recordMessage,
  startVoiceSession,
  finishVoiceSession
};
```

## 3. Count messages

Open:

```text
bot/src/events/messageCreate.js
```

Add this import near the other imports:

```js
const {
  recordMessage
} = require('../services/memberActivityService');
```

Find:

```js
if (message.author.bot) return;
```

Immediately after it, add:

```js
recordMessage(message).catch((error) => {
  console.error(
    'Member message activity could not be recorded:',
    error.message
  );
});
```

This stores a count only. It does not store message text.

## 4. Track voice time

Open:

```text
bot/src/events/voiceStateUpdate.js
```

Add this import:

```js
const {
  startVoiceSession,
  finishVoiceSession
} = require('../services/memberActivityService');
```

Inside the event handler, after these lines:

```js
const user = newState.member?.user;
if (!user || user.bot) return;
```

add:

```js
const activityMember = newState.member || oldState.member;
const activityData = {
  guildId: guild.id,
  userId: user.id,
  userTag: user.tag,
  displayName:
    activityMember?.displayName || user.username
};
```

Replace the current join/leave/move section:

```js
if (!oldChannel && newChannel) {
  await logVoice(client, guild, {
    ...common,
    action: 'Joined',
    channel: newChannel.name,
    channelId: newChannel.id,
  });
} else if (oldChannel && !newChannel) {
  await logVoice(client, guild, {
    ...common,
    action: 'Left',
    channel: oldChannel.name,
    channelId: oldChannel.id,
  });
} else if (oldChannel && newChannel && oldChannel.id !== newChannel.id) {
  await logVoice(client, guild, {
    ...common,
    action: 'Moved',
    from: oldChannel.name,
    fromId: oldChannel.id,
    to: newChannel.name,
    toId: newChannel.id,
  });
}
```

with:

```js
if (!oldChannel && newChannel) {
  await startVoiceSession({
    ...activityData,
    channelName: newChannel.name
  });

  await logVoice(client, guild, {
    ...common,
    action: 'Joined',
    channel: newChannel.name,
    channelId: newChannel.id
  });
} else if (oldChannel && !newChannel) {
  await finishVoiceSession(activityData);

  await logVoice(client, guild, {
    ...common,
    action: 'Left',
    channel: oldChannel.name,
    channelId: oldChannel.id
  });
} else if (
  oldChannel &&
  newChannel &&
  oldChannel.id !== newChannel.id
) {
  await finishVoiceSession(activityData);

  await startVoiceSession({
    ...activityData,
    channelName: newChannel.name
  });

  await logVoice(client, guild, {
    ...common,
    action: 'Moved',
    from: oldChannel.name,
    fromId: oldChannel.id,
    to: newChannel.name,
    toId: newChannel.id
  });
}
```

## 5. Add the API route

Open:

```text
bot/src/dashboardApi.js
```

Add this import near the other model imports:

```js
const MemberActivity = require('./models/MemberActivity');
```

Add this helper near the other helper functions:

```js
function formatActivityDuration(seconds) {
  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  }

  return `${minutes}m`;
}
```

Add this route before the API error handler:

```js
app.get(
  '/api/members/activity',
  asyncRoute(async (req, res) => {
    const guildId = getGuildId(req);
    const guild = client.guilds.cache.get(guildId);

    const [records, messageTotals, trackedMembers] = await Promise.all([
      MemberActivity.find({ guildId })
        .sort({ messageCount: -1, voiceTimeSeconds: -1 })
        .limit(25)
        .lean(),
      MemberActivity.aggregate([
        {
          $match: { guildId }
        },
        {
          $group: {
            _id: null,
            totalMessages: {
              $sum: '$messageCount'
            }
          }
        }
      ]),
      MemberActivity.countDocuments({ guildId })
    ]);

    const onlineMembers = guild
      ? guild.members.cache.filter(
          (member) =>
            member.presence &&
            member.presence.status &&
            member.presence.status !== 'offline'
        ).size
      : 0;

    const membersInVoice = guild
      ? guild.members.cache.filter(
          (member) => Boolean(member.voice.channelId)
        ).size
      : 0;

    const leaderboard = records.map((record) => {
      const member = guild?.members.cache.get(record.userId);
      const liveVoiceSeconds = record.currentVoiceSessionStartedAt
        ? Math.max(
            0,
            Math.floor(
              (Date.now() -
                new Date(
                  record.currentVoiceSessionStartedAt
                ).getTime()) /
                1000
            )
          )
        : 0;

      const voiceTimeSeconds =
        Number(record.voiceTimeSeconds || 0) +
        liveVoiceSeconds;

      return {
        userId: record.userId,
        userTag:
          record.userTag ||
          member?.user?.tag ||
          record.userId,
        displayName:
          record.displayName ||
          member?.displayName ||
          record.userTag ||
          record.userId,
        avatarUrl: member?.user?.displayAvatarURL({
          size: 128
        }),
        messageCount: Number(record.messageCount || 0),
        voiceTimeSeconds,
        voiceTimeFormatted:
          formatActivityDuration(voiceTimeSeconds),
        isOnline: Boolean(
          member?.presence &&
          member.presence.status &&
          member.presence.status !== 'offline'
        ),
        inVoice: Boolean(member?.voice.channelId),
        lastSeenAt: record.lastSeenAt
          ? new Date(record.lastSeenAt).toISOString()
          : undefined
      };
    });

    res.json({
      totalMembers: guild?.memberCount || 0,
      onlineMembers,
      membersInVoice,
      totalMessages: Number(
        messageTotals[0]?.totalMessages || 0
      ),
      trackedMembers,
      leaderboard
    });
  })
);
```

## 6. Restart and test on WispByte

Restart with your existing command:

```bash
cd bot && npm install --omit=dev && npm start
```

Test:

```text
http://78.154.103.12:15874/api/members/activity
```

The response should contain:

```json
{
  "totalMembers": 0,
  "onlineMembers": 0,
  "membersInVoice": 0,
  "totalMessages": 0,
  "trackedMembers": 0,
  "leaderboard": []
}
```

The values will increase when members send messages or use voice channels. Existing message and voice history cannot be reconstructed, so tracking starts after this update.