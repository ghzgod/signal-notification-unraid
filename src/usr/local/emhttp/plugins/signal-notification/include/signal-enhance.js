/* Signal Notification Agent - UI enhancer
 * Auto-discovers signal-cli containers and upgrades GROUP_ID to a dropdown.
 */
$(function() {
  var form = $('form[name="Signal"]');
  if (!form.length) return;

  var urlInput = form.find('input[name="SIGNAL_CLI_URL"]');
  var gidInput = form.find('input[name="GROUP_ID"]');
  if (!urlInput.length || !gidInput.length) return;

  var apiUrl = '/plugins/signal-notification/include/SignalGroupAPI.php';
  var detectedUrl = ''; // URL from auto-discovery

  // Add placeholder to URL field to indicate it's optional
  urlInput.attr('placeholder', 'Optional — overrides detected instance');

  // --- Helper: get the effective URL (override takes priority, then detected) ---
  function getActiveUrl() {
    return urlInput.val().trim() || detectedUrl;
  }

  // --- Replace GROUP_ID text input with select dropdown ---
  var currentVal = gidInput.val();
  var select = $('<select name="GROUP_ID" class="variable" style="min-width:300px;"></select>');
  if (currentVal) {
    select.append($('<option>').val(currentVal).text(currentVal + ' (saved)'));
  } else {
    select.append('<option value="">-- waiting for detection --</option>');
  }
  gidInput.replaceWith(select);

  // --- Add feedback area before the button row ---
  var feedbackDiv = $('<dl><dt>&nbsp;</dt><dd><span id="signal-feedback"></span></dd></dl>');
  form.find('dl:last').before(feedbackDiv);
  var feedback = feedbackDiv.find('#signal-feedback');

  function showFeedback(msg, ok) {
    feedback.text(msg).removeClass('green red').addClass(ok ? 'green' : 'red');
  }

  // --- Replace Delete button with Reset ---
  var deleteBtn = form.find('input[value="Delete"]');
  if (deleteBtn.length) {
    var resetBtn = $('<input type="button" value="Reset">');
    resetBtn.attr('class', deleteBtn.attr('class'));
    deleteBtn.replaceWith(resetBtn);
    resetBtn.on('click', function() {
      urlInput.val('');
      instanceSelect.val('');
      detectedUrl = '';
      select.empty().append('<option value="">-- waiting for detection --</option>');
      form.find('select[name="service"]').val('0');
      feedback.text('').removeClass('green red');
      showFeedback('Settings cleared. Click Apply to save.', true);
    });
  }

  // --- Add instance picker above URL input ---
  var instanceSelect = $('<select id="signal-instance" style="min-width:300px;margin-bottom:4px;"></select>');
  instanceSelect.append('<option value="">Scanning for signal-cli...</option>');
  var instanceRow = $('<dl><dt>Detected Instances</dt><dd></dd></dl>');
  instanceRow.find('dd').append(instanceSelect);
  urlInput.closest('dl').before(instanceRow);

  // When user picks an instance, use it and trigger test
  instanceSelect.on('change', function() {
    var picked = $(this).val();
    if (picked) {
      detectedUrl = picked;
      testAndLoad();
    }
  });

  // --- Add New Group button inline with Apply/Reset buttons ---
  var bottomDl = form.find('dl:last');
  var bottomDd = bottomDl.find('dd');
  var createBtn = $('<input type="button" value="New Group">');
  var existingBtn = bottomDd.find('input[type="button"],input[type="submit"]').first();
  if (existingBtn.length) {
    createBtn.attr('class', existingBtn.attr('class') || '');
    createBtn.css({display:'inline-block', width:existingBtn.outerWidth()+'px', 'margin-top':'0'});
  }
  var lastBtn = bottomDd.find('input[type="button"],input[type="submit"]').last();
  if (lastBtn.length) {
    lastBtn.after(createBtn);
  } else {
    bottomDd.append(createBtn);
  }

  // --- Create Group UI (hidden, below button row) ---
  var createDiv = $('<div style="display:none;margin-top:8px;">' +
    '<input type="text" id="signal-new-name" placeholder="Group name" style="width:180px;margin-right:4px;">' +
    '<input type="text" id="signal-new-members" placeholder="+1234567890,+0987... (optional)" style="width:250px;margin-right:4px;">' +
    '<input type="button" value="Create" id="signal-create-go">' +
    '<input type="button" value="Cancel" id="signal-create-cancel" style="margin-left:4px;">' +
    '</div>');
  bottomDd.append(createDiv);

  createBtn.on('click', function() { createDiv.slideToggle(); });
  createDiv.find('#signal-create-cancel').on('click', function() { createDiv.slideUp(); });
  createDiv.find('#signal-create-go').on('click', function() {
    var url = getActiveUrl();
    var name = createDiv.find('#signal-new-name').val().trim();
    var members = createDiv.find('#signal-new-members').val().trim();
    if (!url || !name) return;
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

  // --- Test connection and load groups ---
  var testTimer = null;
  function testAndLoad() {
    var url = getActiveUrl();
    if (!url) {
      feedback.text('').removeClass('green red');
      select.empty().append('<option value="">-- waiting for detection --</option>');
      return;
    }
    feedback.removeClass('green red').text('Connecting...');
    select.empty().append('<option value="">Loading...</option>');
    $.post(apiUrl, {action:'test', url:url}, function(data) {
      if (data.success) {
        var typeLabel = data.apiType === 'bbernhard' ? 'bbernhard/signal-cli-rest-api' : 'asamk/signal-cli';
        showFeedback(data.message + ' (' + typeLabel + ')', true);
        loadGroups();
      } else {
        showFeedback(data.message || 'Connection failed', false);
        select.empty().append('<option value="">Connection failed</option>');
      }
    }, 'json').fail(function() {
      showFeedback('Failed to reach Unraid backend', false);
      select.empty().append('<option value="">Failed to connect</option>');
    });
  }

  // Auto-test when URL override changes (debounced)
  urlInput.on('change', function() {
    clearTimeout(testTimer);
    testTimer = setTimeout(testAndLoad, 300);
  });

  // --- Load groups function ---
  function loadGroups(selectId) {
    var url = getActiveUrl();
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

  // --- Auto-discover signal-cli instances on page load ---
  var savedUrl = urlInput.val().trim();
  $.post(apiUrl, {action:'discover'}, function(data) {
    var instances = data.instances || [];
    instanceSelect.empty();

    function instanceLabel(inst) {
      var parts = inst.name;
      if (inst.ip) parts += ' \u2014 ' + inst.ip + ':' + inst.port;
      else parts += ' \u2014 port ' + inst.port;
      if (inst.network) parts += ' (' + inst.network + ')';
      return parts;
    }

    if (instances.length === 0) {
      instanceSelect.append('<option value="">No signal-cli containers found</option>');
      // If user has a manual override, test that
      if (savedUrl) testAndLoad();
      return;
    }

    if (instances.length === 1) {
      var inst = instances[0];
      instanceSelect.append($('<option>').val(inst.url).text(instanceLabel(inst)));
      detectedUrl = inst.url;
      testAndLoad();
    } else {
      instanceSelect.append('<option value="">-- Select a signal-cli instance --</option>');
      $.each(instances, function(i, inst) {
        var opt = $('<option>').val(inst.url).text(instanceLabel(inst));
        if (inst.url === savedUrl) {
          opt.attr('selected', true);
          detectedUrl = inst.url;
        }
        instanceSelect.append(opt);
      });
      if (detectedUrl || savedUrl) testAndLoad();
    }
  }, 'json').fail(function() {
    instanceSelect.empty().append('<option value="">Discovery failed</option>');
    if (savedUrl) testAndLoad();
  });
});
