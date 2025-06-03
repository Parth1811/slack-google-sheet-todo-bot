function fetchSlackMessage(row, permalink) {
  var regex = /https:\/\/.*\.slack\.com\/archives\/(.*?)\/p(\d+)/;
  var matches = permalink.match(regex);
  
  if (!matches || matches.length < 3) {
    logError(row, 'Invalid Slack link');
    return false;
  }

  var channelId = matches[1];
  var messageTs = matches[2].slice(0, -6) + '.' + matches[2].slice(-6);
  
  var url = 'https://slack.com/api/conversations.history?channel=' + channelId +
            '&oldest=' + messageTs + '&latest=' + messageTs +
            '&inclusive=true&limit=1';
  
  var options = {
    'method': 'get',
    'headers': {
      'Authorization': 'Bearer ' + SLACK_TOKEN
    }
  };
  
  var response = UrlFetchApp.fetch(url, options);
  var result = JSON.parse(response.getContentText());

  if (result.ok && result.messages.length > 0) {
    var messageObj = result.messages[0];
    SHEET.getRange(row, LINK_OR_MSG_COL).setValue(messageObj.text); // Write message to column B
    saveID(row, MSG_ID_COL, messageObj.ts);
    saveID(row, CHANNEL_ID_COL, channelId);
    saveID(row, SLACK_LINK_COL, permalink);
    return messageObj.text;
  } else {
    logError(row, 'Message not found');
    return false;
  }
}

function reactToSlackMessage(row, emoji) {
  var messageTs = getMsgId(row);
  var channelId = getChannelId(row);

  var url = 'https://slack.com/api/reactions.add';
  
  var payload = {
    'channel': channelId,
    'timestamp': messageTs, // Format: '1709800000.012345'
    'name': emoji // Emoji name without colons, e.g., 'thumbsup'
  };

  var options = {
    'method': 'post',
    'headers': {
      'Authorization': 'Bearer ' + SLACK_TOKEN,
      'Content-Type': 'application/json'
    },
    'payload': JSON.stringify(payload)
  };

  var response = UrlFetchApp.fetch(url, options);
  var result = JSON.parse(response.getContentText());

  if (result.ok) {
    Logger.log('Successfully reacted with :' + emoji + ':');
    return true;
  } else {
    if (result.error === 'already_reacted'){
      logError(row, 'Failed to react: ' + result.error);
    }
    return false;
  }
}

function removeSlackReaction(row, emoji) {
  // Retrieve message timestamp and channel ID from helper functions:
  var messageTs = getMsgId(row);       // e.g., "1709800000.012345"
  var channelId = getChannelId(row);   // e.g., "C1234567890"

  // Slack API URL for removing reactions:
  var url = 'https://slack.com/api/reactions.remove';

  // Construct the JSON payload:
  var payload = {
    'channel': channelId,
    'timestamp': messageTs,
    'name': emoji
  };

  // Set up UrlFetchApp options for a POST with JSON body:
  var options = {
    'method': 'post',
    'headers': {
      'Authorization': 'Bearer ' + SLACK_TOKEN,
      'Content-Type': 'application/json'
    },
    'payload': JSON.stringify(payload)
  };

  // Perform the HTTP request:
  var response = UrlFetchApp.fetch(url, options);
  var result = JSON.parse(response.getContentText());

  // Check the result:
  if (result.ok) {
    Logger.log('Removed reaction :' + emoji + ': successfully');
    return true;
  } else {
    // If the reaction wasn’t there or removal failed, handle error:
    if (result.error === 'no_reaction') {
      logError(row, 'Failed to remove reaction: ‘no_reaction’');
    } else {
      logError(row, 'Failed to remove reaction: ' + result.error);
    }
    return false;
  }
}

function sendMessageToSlackChannel(channelId, messageText) {
  var url = 'https://slack.com/api/chat.postMessage';
  
  var payload = {
    'channel': channelId,
    'blocks': messageText,
    'unfurl_links': false
  };

  var options = {
    'method': 'post',
    'headers': {
      'Authorization': 'Bearer ' + SLACK_TOKEN,
      'Content-Type': 'application/json'
    },
    'payload': JSON.stringify(payload)
  };

  var response = UrlFetchApp.fetch(url, options);
  var result = JSON.parse(response.getContentText());

  if (result.ok) {
    Logger.log('Message sent successfully to channel: ' + channelId);
  } else {
    Logger.log('Failed to send message: ' + result.error);
  }
}

