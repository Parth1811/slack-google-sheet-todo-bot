function addTaskToGoogleCalendarTasks(row, taskObj) {
  // Access the Google Tasks API
  var taskList = Tasks.Tasklists.list().items[0].id; // Get the default task list

  // Extract values from the task object
  var taskTitle = taskObj.title;      // Title of the task
  var taskDate = taskObj.date;        // Date (in YYYY-MM-DD format)
  var taskDescription = taskObj.description; // Description of the task
  
  // Combine the date and time into a Date object (assuming the task object includes time info)
  var taskDateTime = new Date(taskDate);  // If you have a specific time, append it similarly

  // Create the task
  if (taskTitle && taskDateTime) {
    var task = {
      title: taskTitle,
      notes: taskDescription,  // Add description to task as notes
      due: taskDateTime.toISOString() // Due date in ISO format
    };

    // Insert the task into the Google Tasks list
    try {
          var taskResponse = Tasks.Tasks.insert(task, taskList);
          saveID(row, TASK_ID_COL, taskResponse.id);
          saveID(row, GOOGLE_TASK_LINK_COL, taskResponse.webViewLink);
          reactToSlackMessage(row, INSERT_FEEDBACK_EMOJI);
          Logger.log('Tasks inserted');
    } catch(e) {
        logError(row, 'Unable to insert the Task');
    }
  }
}

function completeTaskInGoogleCalendarTasks(row, insertTaskRow, processor = false){
  var taskList = Tasks.Tasklists.list().items[0].id; // Get the default task list
  var taskId = getTaskId(insertTaskRow);
  if (taskId !== null){
    var task = Tasks.Tasks.get(taskList, taskId);
    if (!task) {
      logError(row, 'No tasks found with ID in task list');
      return;
    }
    
    task.status = 'completed';
    var completedTask = Tasks.Tasks.update(task, taskList, taskId);
    if (completedTask !== null && completedTask.status === 'completed'){
      internalCompleteTask(insertTaskRow, row, processor);
    }
  } else {
    logError(row, 'Empty task id cannot update task')
  }
}

function internalCompleteTask(insertTaskRow, row, processor = false){
  reactToSlackMessage(insertTaskRow, COMPLETE_FEEDBACK_EMOJI);
  var saveRow = DB_SHEET.getLastRow();
  DB_SHEET.getRange(saveRow+1, DB_MSG_ID_COL).setValue(getMsgId(insertTaskRow));
  DB_SHEET.getRange(saveRow+1, DB_MSG_TITLE_COL).setValue(getMsgOrLink(insertTaskRow));
  DB_SHEET.getRange(saveRow+1, DB_SLACK_LINK_COL).setValue(getVariable(insertTaskRow, SLACK_LINK_COL));
  DB_SHEET.getRange(saveRow+1, DB_GOOGLE_TASK_LINK_COL).setValue(getVariable(insertTaskRow, GOOGLE_TASK_LINK_COL));
  
  if (processor === false){
    if (row !== null){
      SHEET.deleteRow(row);
    }
    SHEET.deleteRow(insertTaskRow);
  } else {
    if (row !== null){
      setTaskState(row, TaskState.DELETED);
    }
    setTaskState(insertTaskRow, TaskState.DELETED);
  }
  
  Logger.log('Tasks Completed');
}