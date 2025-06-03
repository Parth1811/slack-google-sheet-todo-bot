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

  var message = null;
  if (pendingTaskList.length > 0){
    message = "Hey <" + SLACK_USERNAME + ">, these are your pending tasks, don't be lazy and workk hard buddy :people_hugging:\n";
    for(var i = 0; i < pendingTaskList.length; i++){
      var dueDate = new Date(pendingTaskList[i].due);
      var adjustedDate = new Date(dueDate.getTime() + today.getTimezoneOffset() * 60000);
      adjustedDate.setHours(0,0,0,0);

      var emoji = "";
      if (adjustedDate < today){
        emoji = RED_CIRCLE_EMOJI;
      } else if(adjustedDate > today){
        emoji = GREEN_CIRCLE_EMOJI;
      } else {
        emoji = YELLOW_CIRCLE_EMOJI;
      }

      var ending = '\n';
      if (slackLinkMap.has(pendingTaskList[i].id)) {
        ending = ' <' + slackLinkMap.get(pendingTaskList[i].id) + '|(link)>' + ending;
      }

      message += (i+1).toString() + ". :" + emoji + ": " + toFormattedDate(adjustedDate) + ' - ' + pendingTaskList[i].title + ending;
    }
  } else {
    message = "Woah! Congrats:tada: <" + SLACK_USERNAME + ">, you have no pending tasks for today. Keep it up.";
  }

  // Logger.log(message);
  sendMessageToSlackChannel(SLACK_CHANNEL_ID, message);
}