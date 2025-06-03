function onChange() {

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    var numRows = SHEET.getLastRow(); 

    for (var row = numRows; row >= 2; row--) {
      
      // Avoid doing anything to the header row
      if (row == 1){
        break;
      }

      var cellValue = getMsgOrLink(row); // Get value from column A for each row
      var userName = getUserName(row);
      var emoji = getEmoji(row);
      var pointer = getVariable(row, PROCESS_POINTER_COL);

      if (pointer === 1) {
        break;
      }

      // Remove anything not from the user
      if (userName !== USERNAME) {
        SHEET.deleteRow(row);
        continue;
      }


      // Parse the incoming message
      // Check if the value in the cell starts with 'https://'
      var parsedMessage = null;
      if (emoji === GET_REPORT_EMOJI){
        parsedMessage = "Get Report";
      } else {
        if (cellValue.startsWith('https://')) {
          var message = fetchSlackMessage(row, cellValue);
          if (message !== false){
            parsedMessage = parseMessage(row, message);
            Logger.log(parsedMessage);
            if (parsedMessage === null) {
              logError(row, 'Error with parsing the message')
            }
          }
        }
      }

      // Trigger different routines based on the emooji
      if (parsedMessage !== null){
        switch(emoji){
          case INSERT_EMOJI:
              if (validateNewTaskInsertEntry(getMsgId(row), row)){
                addTaskToGoogleCalendarTasks(row, parsedMessage);
              } else {
                SHEET.deleteRow(row);
              }
              break;
          case COMPLETE_EMOJI:
              if (searchForCompletedTask(getMsgId(row)) < 0){
                completeTask(row);
              } else {
                SHEET.deleteRow(row);
              }
              break;
          case GET_REPORT_EMOJI:
            jobsequences();
            SHEET.deleteRow(row);
          default:
              logError(row, "Inavlid Emoji reaction");
        }
      }

    }
    
    var lastRow = SHEET.getLastRow(); 
    if (lastRow > 1){
      SHEET.getRange(numRows, PROCESS_POINTER_COL).setValue(1);
    }
  } finally {
    lock.releaseLock();
  }
}


function onChangeTaskProcessor() {

  var numRows = SHEET.getLastRow(); 

  for (var row = numRows; row >= 2; row--) {
    
    // Avoid doing anything to the header row
    if (row == 1){
      break;
    }

    var cellValue = getMsgOrLink(row); // Get value from column A for each row
    var userName = getUserName(row);
    var emoji = getEmoji(row);
    var state = getVariable(row, TASK_STATE_COL);

    // Remove anything not from the user
    if (userName !== USERNAME || cellValue == null || cellValue == undefined || cellValue == '') {
      setTaskState(row, TaskState.DELETED);
      state = TaskState.DELETED;
    }

    if (state == TaskState.PROCESSING || state == TaskState.PROCESSED) {
      continue;
    } else if (state == TaskState.PARSED || state == TaskState.DELETED){
      taskProcessor(row);
      continue;
    }

    // Parse the incoming message
    // Check if the value in the cell starts with 'https://'
    setTaskState(row, TaskState.PARSING);

    var parsedMessage = null;
    if (emoji === GET_REPORT_EMOJI){
      parsedMessage = "Get Report";
    } else {
      if (cellValue.startsWith('https://')) {
        var message = fetchSlackMessage(row, cellValue);
        if (message !== false){
          parsedMessage = parseMessage(row, message);
          Logger.log(parsedMessage);
          if (parsedMessage === null) {
            logError(row, 'Error with parsing the message')
          }
        }
      }
    }

    if (parsedMessage !== null){
      setTaskState(row, TaskState.PARSED);
    } else {
      setTaskState(row, TaskState.DELETED);
    }
  
    taskProcessor(row);
  }
}


function validateNewTaskInsertEntry(messageTs, row) {
  var insertTaskRow = searchForInsertedTask(messageTs, row-1);
  Logger.log("InsertTaskRow " + insertTaskRow);
  if (insertTaskRow > 1) {
    return false;
  }

  var completeTaskRow = searchForCompletedTask(messageTs);
  if (completeTaskRow > 1) {
    return false;
  }

  return true;
}

function completeTask(row, processor = false){
  var messageId = getMsgId(row);
  var insertTaskRow = searchForInsertedTask(messageId);

  if (insertTaskRow > 0){
    completeTaskInGoogleCalendarTasks(row, insertTaskRow, processor);
  } else {
    logError(row, "Unable to complete non-existing tasks")
  }
}