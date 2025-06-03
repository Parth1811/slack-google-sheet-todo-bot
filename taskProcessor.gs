function taskProcessor(row) {
  const lock = LockService.getScriptLock();
  try {
    if (lock.tryLock(10)) {
      // This is a master processor

      let taskId = row;
      while (taskId !== null) {
        console.log("Task Id: " + taskId);

        let state = getTaskState(taskId);
        console.log("Task Id: " + taskId + "state: " + state);

        if (state == TaskState.PARSED) {
          setTaskState(taskId, TaskState.PROCESSING);
          reactToSlackMessage(taskId, PROCESSING_EMOJI);
          processTask(taskId);
          removeSlackReaction(taskId, PROCESSING_EMOJI);
          if (getTaskState(taskId) != TaskState.DELETED) {
            setTaskState(taskId, TaskState.PROCESSED);
          }
        } else if (state == TaskState.DELETED) {
          console.log("Task Id: " + taskId + " already deleted");
        } else if (state == TaskState.PROCESSED) {
          console.log("Task Id: " + taskId + " already processed");
        } else {
          setTaskState(taskId, TaskState.INVALID);
        }

        if (taskId != row) {
          removeFirstElementFromTaskQueue();
        }

        taskId = getFirstElementFromTaskQueue();

        if (taskId == row) {
          removeFirstElementFromTaskQueue();
          taskId = getFirstElementFromTaskQueue();
        }
      }

      // Delete the row after processing
      let lastRow = SHEET.getLastRow();
      for (let row = lastRow; row >= 2; row--) {
        if (getTaskState(row) == TaskState.DELETED) {
          console.log("Deleting row: " + row);
          SHEET.deleteRow(row);
        }
      }

    } else {
      // This is a slave processor only submit the request to Master
      addElementToTaskQueue(row);
      console.log("Added to Task Queue, row: " + row);
    }
  } finally {
    SpreadsheetApp.flush();
    lock.releaseLock();
  }

}


function processTask(row) {
  // Trigger different routines based on the emooji
  emoji = getEmoji(row);
  switch (emoji) {
    case INSERT_EMOJI:
      if (validateNewTaskInsertEntry(getMsgId(row)), row) {
        let parsedMessage = parseMessage(row, getMsgOrLink(row));
        addTaskToGoogleCalendarTasks(row, parsedMessage);
      } else {
        setTaskState(row, TaskState.DELETED);
      }
      break;
    case COMPLETE_EMOJI:
      if (searchForCompletedTask(getMsgId(row)) < 0) {
        completeTask(row, true);
      } else {
        setTaskState(row, TaskState.DELETED);
      }
      break;
    case GET_REPORT_EMOJI:
      remainingTaskReport();
      setTaskState(row, TaskState.DELETED);
    default:
      logError(row, "Inavlid Emoji reaction");
  }
}