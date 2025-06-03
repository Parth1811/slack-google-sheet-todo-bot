function jobsequences(){
  completeTaskSync();
  remainingTaskReport();
}

function completeTaskSync(){
  var taskList = Tasks.Tasklists.list().items[0].id; // Get the default task list
  var tasks = Tasks.Tasks.list(taskList, {"showCompleted":true, "showHidden": true, "maxResults": 100});
  var completeTaskId = tasks.items.filter(elem => elem.status === 'completed').map(elem => elem.id);

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try{
    for (var row = SHEET.getLastRow(); row >= 1; row--) {
      if (getEmoji(row) === INSERT_EMOJI) {
        var taskId = getTaskId(row);
        Logger.log(taskId);
        if (completeTaskId.findIndex(elem => elem === taskId) >= 0) {
          internalCompleteTask(row, null, false);
        }
      }
    }
  } finally {
    lock.releaseLock();
  }
}

function remainingTaskReport(){
  var today = new Date();
  today.setHours(0,0,0,0);

  var taskList = Tasks.Tasklists.list().items[0].id; // Get the default task list
  var pendingTaskList = Tasks.Tasks.list(taskList, {"showCompleted":false, "showHidden": true, "maxResults": 100}).items;
  pendingTaskList = pendingTaskList.sort((a, b) => new Date(a.due) - new Date(b.due));

  pendingTaskList = pendingTaskList.filter((elem) => {
    var dueDate = new Date(elem.due);
    var adjustedDate = new Date(dueDate.getTime() + today.getTimezoneOffset() * 60000);
    adjustedDate.setHours(0,0,0,0);


    if (elem.title.toLowerCase().startsWith('[m]')){
      return adjustedDate.getMonth() <= today.getMonth();
    } else if (elem.title.toLowerCase().startsWith('[w]')){
      return adjustedDate.getWeekNumber() <= today.getWeekNumber();
    } else if (elem.title.toLowerCase().startsWith('[d]')){
      return adjustedDate.getMonth() <= today.getMonth() && adjustedDate.getDate() <= today.getDate() && adjustedDate.getFullYear() <= today.getFullYear();
    } else {
      return true;
    }
  });

  var slackLinkMap = new Map();
  for (var row = SHEET.getLastRow(); row > 1; row--) {
    if (getEmoji(row) === INSERT_EMOJI) {
      slackLinkMap.set(getTaskId(row), getSlackMsgLink(row));
    }
  }


  const blocks = [];

  // Header
  blocks.push({
    type: "header",
    text: {
      type: "plain_text",
      text: `:clipboard: Pending Tasks for ${USERNAME}`,
      emoji: true
    }
  });

  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `Hey <${SLACK_USERNAME}>, here are your tasks:`
      }
    ]
  });

  blocks.push({ type: "divider" });


  // If there are pending tasks, list them; otherwise show a “no tasks” section
  if (pendingTaskList.length > 0) {
    pendingTaskList.forEach((task, i) => {
      const dueDate = new Date(task.due);
      const adjustedDate = new Date(dueDate.getTime() + today.getTimezoneOffset() * 60000);
      adjustedDate.setHours(0, 0, 0, 0);

      let emoji = "";
      if (adjustedDate < today) {
        emoji = `:${RED_CIRCLE_EMOJI}:`;
      } else if (adjustedDate > today) {
        emoji = `:${GREEN_CIRCLE_EMOJI}:`;
      } else {
        emoji = `:${YELLOW_CIRCLE_EMOJI}:`;
      }

      const formattedDate = toFormattedDate(adjustedDate);
      const linkPart = slackLinkMap.has(task.id)
        ? ` — <${slackLinkMap.get(task.id)}|View>`
        : "";

      // Each task as its own “section” block
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${i + 1}.* ${emoji} *${formattedDate}* — ${task.title}${linkPart}`
        }
      });
    });
  } else {
    // If no pending tasks
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: ":tada: *All caught up!* You have no pending tasks for today."
      }
    });
  }

  // Footer/context
  blocks.push({ type: "divider" });
  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: "Keep up the great work! :muscle:"
      }
    ]
  });

  // Logger.log(message);
  sendMessageToSlackChannel(SLACK_CHANNEL_ID, blocks);
}