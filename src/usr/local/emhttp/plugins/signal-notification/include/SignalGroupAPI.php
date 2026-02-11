<?PHP
/* Signal Notification Plugin - AJAX API for group management */

// Require Unraid login
$docroot = $docroot ?? $_SERVER['DOCUMENT_ROOT'] ?: '/usr/local/emhttp';
require_once "$docroot/webGui/include/Wrappers.php";

header('Content-Type: application/json');

$action = $_POST['action'] ?? $_GET['action'] ?? '';
$url = trim($_POST['url'] ?? '');

if (empty($url)) {
    $cfg = @parse_ini_file('/boot/config/plugins/signal-notification/signal.cfg');
    $url = $cfg['SIGNAL_CLI_URL'] ?? '';
}

if (empty($url)) {
    echo json_encode(['error' => 'Signal-CLI URL not provided']);
    exit;
}

// Ensure URL doesn't have trailing slash
$url = rtrim($url, '/');
$rpcUrl = $url . '/api/v1/rpc';

function signalRpc($rpcUrl, $method, $params = []) {
    $payload = json_encode([
        'jsonrpc' => '2.0',
        'method'  => $method,
        'params'  => (object)$params,
        'id'      => 1
    ]);
    $ch = curl_init($rpcUrl);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_CONNECTTIMEOUT => 5,
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($error) {
        return ['error' => "Connection failed: $error"];
    }
    if ($httpCode !== 200) {
        return ['error' => "HTTP $httpCode from signal-cli"];
    }
    $data = json_decode($response, true);
    if (isset($data['error'])) {
        return ['error' => $data['error']['message'] ?? 'Unknown RPC error'];
    }
    return $data;
}

switch ($action) {
    case 'test':
        $result = signalRpc($rpcUrl, 'listGroups');
        if (isset($result['error'])) {
            echo json_encode(['success' => false, 'message' => $result['error']]);
        } else {
            $count = count($result['result'] ?? []);
            echo json_encode(['success' => true, 'message' => "Connected. Found $count group(s)."]);
        }
        break;

    case 'listGroups':
        $result = signalRpc($rpcUrl, 'listGroups');
        if (isset($result['error'])) {
            echo json_encode(['error' => $result['error']]);
            break;
        }
        $groups = [];
        foreach ($result['result'] ?? [] as $group) {
            // Only include active groups (not blocked/left)
            if (isset($group['isMember']) && !$group['isMember']) continue;
            if (isset($group['isBlocked']) && $group['isBlocked']) continue;
            $groups[] = [
                'id'   => $group['id'] ?? '',
                'name' => $group['name'] ?? '(unnamed group)',
            ];
        }
        usort($groups, function($a, $b) { return strcasecmp($a['name'], $b['name']); });
        echo json_encode(['groups' => $groups]);
        break;

    case 'createGroup':
        $name = trim($_POST['name'] ?? '');
        $members = array_filter(array_map('trim', explode(',', $_POST['members'] ?? '')));
        if (empty($name)) {
            echo json_encode(['error' => 'Group name is required']);
            break;
        }
        $params = ['name' => $name];
        if (!empty($members)) {
            $params['members'] = $members;
        }
        $result = signalRpc($rpcUrl, 'updateGroup', $params);
        if (isset($result['error'])) {
            echo json_encode(['error' => $result['error']]);
        } else {
            $groupId = $result['result']['groupId'] ?? '';
            echo json_encode(['success' => true, 'groupId' => $groupId, 'name' => $name]);
        }
        break;

    case 'sendTest':
        $groupId = $_POST['groupId'] ?? '';
        if (empty($groupId)) {
            echo json_encode(['error' => 'No group selected']);
            break;
        }
        $hostname = gethostname();
        $result = signalRpc($rpcUrl, 'send', [
            'groupId' => $groupId,
            'message' => "$hostname: Signal notification test from Unraid plugin."
        ]);
        if (isset($result['error'])) {
            echo json_encode(['error' => $result['error']]);
        } else {
            $success = false;
            foreach ($result['result']['results'] ?? [] as $r) {
                if (($r['type'] ?? '') === 'SUCCESS') { $success = true; break; }
            }
            echo json_encode(['success' => $success, 'message' => $success ? 'Test message sent!' : 'Send failed']);
        }
        break;

    default:
        echo json_encode(['error' => 'Unknown action']);
}
