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

  // --- Add Test Connection button and status below URL input ---
  var testBtn = $('<input type="button" value="Test Connection" style="margin-left:8px;">');
  var statusDiv = $('<div class="signal-conn-result" style="margin-top:4px;"></div>');
  urlInput.after(testBtn);
  urlInput.closest('dd').append(statusDiv);

  function setStatus(msg, ok) {
    statusDiv.text(msg).removeClass('green red').addClass(ok ? 'green' : 'red');
  }

  testBtn.on('click', function() {
    var url = urlInput.val().trim();
    if (!url) { setStatus('Enter URL first', false); return; }
    statusDiv.removeClass('green red').text('Testing...');
    $.post(apiUrl, {action:'test', url:url}, function(data) {
      if (data.success) {
        setStatus(data.message, true);
        loadGroups();
      } else {
        setStatus(data.message || 'Connection failed', false);
      }
    }, 'json').fail(function() {
      setStatus('Failed to reach Unraid backend', false);
    });
  });

  // --- Replace GROUP_ID text input with select dropdown ---
  var currentVal = gidInput.val();
  var select = $('<select name="GROUP_ID" class="variable" style="min-width:300px;"></select>');
  if (currentVal) {
    select.append($('<option>').val(currentVal).text(currentVal + ' (saved)'));
  } else {
    select.append('<option value="">-- Load groups first --</option>');
  }
  gidInput.replaceWith(select);

  var loadBtn = $('<input type="button" value="Load Groups" style="margin-left:8px;">');
  var sendTestBtn = $('<input type="button" value="Send Test" style="margin-left:4px;">');
  var createBtn = $('<input type="button" value="New Group" style="margin-left:4px;">');
  var groupStatusDiv = $('<div class="signal-group-result" style="margin-top:4px;"></div>');
  select.after(createBtn).after(sendTestBtn).after(loadBtn);
  select.parent().append(groupStatusDiv);

  function setGroupStatus(msg, ok) {
    groupStatusDiv.text(msg).removeClass('green red').addClass(ok ? 'green' : 'red');
    if (ok) setTimeout(function(){ groupStatusDiv.fadeOut(function(){ $(this).text('').removeClass('green red').show(); }); }, 5000);
  }

  sendTestBtn.on('click', function() {
    var url = urlInput.val().trim();
    var gid = select.val();
    if (!url) { setGroupStatus('Enter Signal-CLI URL first', false); return; }
    if (!gid) { setGroupStatus('Select a group first', false); return; }
    groupStatusDiv.removeClass('green red').text('Sending...');
    $.post(apiUrl, {action:'sendTest', url:url, groupId:gid}, function(data) {
      if (data.success) {
        setGroupStatus(data.message, true);
      } else {
        setGroupStatus(data.error || data.message || 'Send failed', false);
      }
    }, 'json').fail(function() {
      setGroupStatus('Failed to reach backend', false);
    });
  });

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
    $.post(apiUrl, {action:'test', url:initUrl}, function(data) {
      if (data.success) {
        setStatus(data.message, true);
        loadGroups();
      }
    }, 'json');
  }
});
