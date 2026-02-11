/* Signal Notification Agent - UI enhancer
 * Upgrades the GROUP_ID text input into a dynamic dropdown
 * and adds action buttons to the bottom row.
 */
$(function() {
  var form = $('form[name="Signal"]');
  if (!form.length) return;

  var urlInput = form.find('input[name="SIGNAL_CLI_URL"]');
  var gidInput = form.find('input[name="GROUP_ID"]');
  if (!urlInput.length || !gidInput.length) return;

  var apiUrl = '/plugins/signal-notification/include/SignalGroupAPI.php';

  // --- Replace GROUP_ID text input with select dropdown (no inline buttons) ---
  var currentVal = gidInput.val();
  var select = $('<select name="GROUP_ID" class="variable" style="min-width:300px;"></select>');
  if (currentVal) {
    select.append($('<option>').val(currentVal).text(currentVal + ' (saved)'));
  } else {
    select.append('<option value="">-- Load groups first --</option>');
  }
  gidInput.replaceWith(select);

  // --- Add feedback area before the button row ---
  var feedbackDiv = $('<dl><dt>&nbsp;</dt><dd><span id="signal-feedback"></span></dd></dl>');
  form.find('dl:last').before(feedbackDiv);
  var feedback = feedbackDiv.find('#signal-feedback');

  function showFeedback(msg, ok) {
    feedback.text(msg).removeClass('green red').addClass(ok ? 'green' : 'red');
  }

  // --- Add our buttons to the bottom row alongside Apply/Done ---
  var bottomDd = form.find('dl:last dd');
  bottomDd.css('text-align', 'center');
  var testConnBtn = $('<input type="button" value="Test Connection">');
  var loadBtn = $('<input type="button" value="Load Groups">');
  var sendTestBtn = $('<input type="button" value="Send Test">');
  var createBtn = $('<input type="button" value="New Group">');
  bottomDd.append(testConnBtn).append(loadBtn).append(sendTestBtn).append(createBtn);

  // --- Create Group UI (hidden, appended after buttons) ---
  var createDiv = $('<div style="display:none;margin-top:8px;">' +
    '<input type="text" id="signal-new-name" placeholder="Group name" style="width:180px;margin-right:4px;">' +
    '<input type="text" id="signal-new-members" placeholder="+1234567890,+0987... (optional)" style="width:250px;margin-right:4px;">' +
    '<input type="button" value="Create" id="signal-create-go">' +
    '<input type="button" value="Cancel" id="signal-create-cancel" style="margin-left:4px;">' +
    '</div>');
  bottomDd.append(createDiv);

  // --- Button handlers ---
  testConnBtn.on('click', function() {
    var url = urlInput.val().trim();
    if (!url) { showFeedback('Enter URL first', false); return; }
    feedback.removeClass('green red').text('Testing...');
    $.post(apiUrl, {action:'test', url:url}, function(data) {
      if (data.success) {
        showFeedback(data.message, true);
        loadGroups();
      } else {
        showFeedback(data.message || 'Connection failed', false);
      }
    }, 'json').fail(function() {
      showFeedback('Failed to reach Unraid backend', false);
    });
  });

  loadBtn.on('click', function() { loadGroups(); });

  sendTestBtn.on('click', function() {
    var url = urlInput.val().trim();
    var gid = select.val();
    if (!url) { showFeedback('Enter Signal-CLI URL first', false); return; }
    if (!gid) { showFeedback('Select a group first', false); return; }
    feedback.removeClass('green red').text('Sending...');
    $.post(apiUrl, {action:'sendTest', url:url, groupId:gid}, function(data) {
      if (data.success) {
        showFeedback(data.message, true);
      } else {
        showFeedback(data.error || data.message || 'Send failed', false);
      }
    }, 'json').fail(function() {
      showFeedback('Failed to reach backend', false);
    });
  });

  createBtn.on('click', function() { createDiv.slideToggle(); });
  createDiv.find('#signal-create-cancel').on('click', function() { createDiv.slideUp(); });
  createDiv.find('#signal-create-go').on('click', function() {
    var url = urlInput.val().trim();
    var name = createDiv.find('#signal-new-name').val().trim();
    var members = createDiv.find('#signal-new-members').val().trim();
    if (!name) return;
    $.post(apiUrl, {action:'createGroup', url:url, name:name, members:members}, function(data) {
      if (data.error) {
        showFeedback('Failed to create group: ' + data.error, false);
      } else {
        showFeedback('Group "' + name + '" created!', true);
        createDiv.find('#signal-new-name').val('');
        createDiv.find('#signal-new-members').val('');
        createDiv.slideUp();
        loadGroups(data.groupId);
      }
    }, 'json');
  });

  // --- Load groups function ---
  function loadGroups(selectId) {
    var url = urlInput.val().trim();
    if (!url) return;
    select.empty().append('<option value="">Loading...</option>');
    $.post(apiUrl, {action:'listGroups', url:url}, function(data) {
      select.empty();
      if (data.error) {
        select.append($('<option value="">').text('Error: ' + data.error));
        return;
      }
      select.append('<option value="">-- Select a group --</option>');
      var toSelect = selectId || currentVal;
      $.each(data.groups || [], function(i, g) {
        var opt = $('<option>').val(g.id).text(g.name);
        if (g.id === toSelect) opt.attr('selected', true);
        select.append(opt);
      });
    }, 'json').fail(function() {
      select.empty().append('<option value="">Failed to load</option>');
    });
  }

  // Auto-test and load groups on page init if URL is set
  var initUrl = urlInput.val().trim();
  if (initUrl) {
    $.post(apiUrl, {action:'test', url:initUrl}, function(data) {
      if (data.success) {
        showFeedback(data.message, true);
        loadGroups();
      }
    }, 'json');
  }
});
