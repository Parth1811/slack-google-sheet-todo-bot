function parseMessage(row, message) {
  // Split the message by commas and trim whitespace
  var parts = message.split(',').map(part => part.trim());
  
  // Extract date, title, and description (optional)
  var dateStr = parts[0];
  var title = titleCase(parts[1] || 'No Title');
  var description = parts[2] || '';

  // Convert natural language date into a Date object
  var date = parseNaturalDate(dateStr);
  
  if (date) {
    Logger.log('Parsed Date: ' + date);
  } else {
    logError(row, 'Invalid Date');
    return null;
  }
  
  Logger.log('Title: ' + title);
  Logger.log('Description: ' + description);
  
  return { date: date, title: title, description: description };
}

function parseNaturalDate(dateStr) {
  dateStr = dateStr.toLowerCase();
  var now = new Date();
  
  
  if (dateStr === 'today'){
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
    
  else if (dateStr === 'tomorrow' || dateStr === 'tom'){
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  }
  
  else if (dateStr === 'yesterday'){
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  }

  else if (dateStr.toLowerCase() in WEEKDAYS){
    var dayKey = dateStr.toLowerCase(); // Normalize input
    var currentDay = now.getDay(); // Sunday = 0, Monday = 1, ..., Saturday = 6
    var targetDay = WEEKDAYS[dayKey];
    var daysUntilNext = (targetDay - currentDay + 7) % 7 || 7; // Ensure next occurrence
    
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilNext);
  }

  else if (dateStr.startsWith('+')){
    var inc = parseInt(dateStr.split('+')[1])
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + inc);
  }

  else if (dateStr.startsWith('-')){
    var inc = parseInt(dateStr.split('-')[1])
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - inc);
  }

  else {
    // Try standard date parsing for "March 6", "2025-03-06", etc.
    var parsedDate = new Date(dateStr);
    if (isNaN(parsedDate) && parseInt(dateStr) <= 31){
      parsedDate = new Date(now.getFullYear(), now.getMonth(), parseInt(dateStr));
    }

    if (parsedDate.getFullYear() === 2001) {
      parsedDate.setFullYear(now.getFullYear());
    }
    return isNaN(parsedDate) ? null : parsedDate;
  }

}