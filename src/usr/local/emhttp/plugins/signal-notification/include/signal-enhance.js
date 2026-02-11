/* Signal Notification Agent - UI enhancer
 * Upgrades the GROUP_ID text input into a dynamic dropdown
 * and adds Test Connection / Load Groups buttons.
 */
$(function() {
  var form = $('form[name="Signal"]');
  if (!form.length) return;

  var urlInput = form.find('input[name="SIGNAL_CLI_URL"]');
  var gidInput = form.find('input[name="GROUP_ID"]');
  if (!urlInput.length || !gidInput.length) return;

  var apiUrl = '/plugins/signal-notification/include/SignalGroupAPI.php';

  // --- Add Test Connection button next to URL input ---
  var statusSpan = $('<span class="signal-conn-status" style="display:inline-block;padding:2px 8px;border-radius:3px;font-size:0.9em;margin-left:8px;">Not tested</span>');
  var testBtn = $('<input type="button" value="Test Connection" style="margin-left:8px;">');
  urlInput.after(statusSpan).after(testBtn);

  testBtn.on('click', function() {
    var url = urlInput.val().trim();
    if (!url) { statusSpan.css({background:'#f44336',color:'#fff'}).text('Enter URL first'); return; }
    statusSpan.css({background:'#FF9800',color:'#fff'}).text('Testing...');
    $.post(apiUrl, {action:'test', url:url}, function(data) {
      if (data.success) {
        statusSpan.css({background:'#4CAF50',color:'#fff'}).text('Connected');
        loadGroups();
      } else {
        statusSpan.css({background:'#f44336',color:'#fff'}).text('Failed');
      }
    }, 'json').fail(function() {
      statusSpan.css({background:'#f44336',color:'#fff'}).text('Error');
    });
  });

  // --- Replace GROUP_ID text input with select dropdown ---
  var currentVal = gidInput.val();
  var select = $('<select name="GROUP_ID" class="variable" style="min-width:300px;"></select>');
  if (currentVal) {
    select.append($('<option>').val(currentVal).text(currentVal + ' (saved)'));
  } else {
    select.append($('<option value="">-- Load groups first --</option>'));
  }
  gidInput.replaceWith(select);

  var loadBtn = $('<input type="button" value="Load Groups" style="margin-left:8px;">');
  var createBtn = $('<input type="button" value="New Group" style="margin-left:4px;">');
  select.after(createBtn).after(loadBtn);

  // --- Create Group UI (hidden by default) ---
  var createDiv = $('<div style="display:none;margin-top:8px;">' +
    '<input type="text" id="signal-new-name" placeholder="Group name" style="width:180px;margin-right:4px;">' +
    '<input type="text" id="signal-new-members" placeholder="+1234567890,+0987... (optional)" style="width:250px;margin-right:4px;">' +
    '<input type="button" value="Create" id="signal-create-go">' +
    '<input type="button" value="Cancel" id="signal-create-cancel" style="margin-left:4px;">' +
    '</div>');
  select.parent().append(createDiv);

  createBtn.on('click', function() { createDiv.slideToggle(); });
  createDiv.find('#signal-create-cancel').on('click', function() { createDiv.slideUp(); });
  createDiv.find('#signal-create-go').on('click', function() {
    var url = urlInput.val().trim();
    var name = createDiv.find('#signal-new-name').val().trim();
    var members = createDiv.find('#signal-new-members').val().trim();
    if (!name) return;
    $.post(apiUrl, {action:'createGroup', url:url, name:name, members:members}, function(data) {
      if (data.error) {
        alert('Failed: ' + data.error);
      } else {
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

  loadBtn.on('click', function() { loadGroups(); });

  // Auto-load groups on page init if URL is set
  var initUrl = urlInput.val().trim();
  if (initUrl) {
    // Quick connection test then load groups
    $.post(apiUrl, {action:'test', url:initUrl}, function(data) {
      if (data.success) {
        statusSpan.css({background:'#4CAF50',color:'#fff'}).text('Connected');
        loadGroups();
      }
    }, 'json');
  }
});
