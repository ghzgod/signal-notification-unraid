<?PHP
/* Signal Notification Plugin - AJAX API for group management
 * Supports both asamk/signal-cli (JSON-RPC) and bbernhard/signal-cli-rest-api (REST)
 */

// Require Unraid login
$docroot = $docroot ?? $_SERVER['DOCUMENT_ROOT'] ?: '/usr/local/emhttp';
require_once "$docroot/webGui/include/Wrappers.php";

header('Content-Type: application/json');

$action = $_POST['action'] ?? $_GET['action'] ?? '';
$url = trim($_POST['url'] ?? '');

if (empty($url)) {
    // Try config file first, then agent script
    $cfg = @parse_ini_file('/boot/config/plugins/signal-notification/signal.cfg');
    $url = $cfg['SIGNAL_CLI_URL'] ?? '';
    if (empty($url)) {
        // Read from agent script (between ###### markers)
        foreach (['/boot/config/plugins/dynamix/notifications/agents/Signal.sh',
                  '/boot/config/plugins/dynamix/notifications/agents-disabled/Signal.sh'] as $agentFile) {
            if (is_file($agentFile)) {
                preg_match('/#{6,}(.*?)#{6,}/s', file_get_contents($agentFile), $m);
                if (isset($m[1])) {
                    foreach (explode("\n", $m[1]) as $line) {
                        if (preg_match('/^SIGNAL_CLI_URL="(.*)"/', trim($line), $mv)) {
                            $url = $mv[1];
                            break 2;
                        }
                    }
                }
            }
        }
    }
}

if (empty($url)) {
    echo json_encode(['error' => 'Signal-CLI URL not provided']);
    exit;
}

// Ensure URL doesn't have trailing slash
$url = rtrim($url, '/');
$rpcUrl = $url . '/api/v1/rpc';

$cfgFile = '/boot/config/plugins/signal-notification/signal.cfg';

// --- Helper: JSON-RPC call for asamk/signal-cli ---
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

// --- Helper: REST call for bbernhard/signal-cli-rest-api ---
function signalRest($url, $method, $path, $body = null) {
    $ch = curl_init($url . $path);
    $opts = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
    ];
    if ($method === 'POST') {
        $opts[CURLOPT_POST] = true;
        if ($body !== null) {
            $opts[CURLOPT_POSTFIELDS] = is_string($body) ? $body : json_encode($body);
        }
    } elseif ($method === 'PUT') {
        $opts[CURLOPT_CUSTOMREQUEST] = 'PUT';
        if ($body !== null) {
            $opts[CURLOPT_POSTFIELDS] = is_string($body) ? $body : json_encode($body);
        }
    }
    curl_setopt_array($ch, $opts);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($error) {
        return ['error' => "Connection failed: $error", 'httpCode' => 0];
    }
    $data = json_decode($response, true);
    return ['httpCode' => $httpCode, 'data' => $data, 'raw' => $response];
}

// --- Detect API type: asamk vs bbernhard ---
function detectApiType($url) {
    // Try bbernhard first: GET /v1/about
    $result = signalRest($url, 'GET', '/v1/about');
    if (!isset($result['error']) && $result['httpCode'] === 200 && isset($result['data']['build'])) {
        // It's bbernhard — now get the registered account number
        $account = '';
        $acctResult = signalRest($url, 'GET', '/v1/accounts');
        if (!isset($acctResult['error']) && $acctResult['httpCode'] === 200 && is_array($acctResult['data'])) {
            foreach ($acctResult['data'] as $acct) {
                if (is_string($acct) && strpos($acct, '+') === 0) {
                    $account = $acct;
                    break;
                }
            }
        }
        if (empty($account)) {
            return ['type' => 'bbernhard', 'account' => '', 'error' => 'bbernhard detected but no registered account found. Register a number first.'];
        }
        return ['type' => 'bbernhard', 'account' => $account];
    }

    // Try asamk: JSON-RPC listGroups
    $rpcUrl = $url . '/api/v1/rpc';
    $rpcResult = signalRpc($rpcUrl, 'listGroups');
    if (!isset($rpcResult['error'])) {
        return ['type' => 'asamk', 'account' => ''];
    }

    // Neither worked
    return ['type' => '', 'error' => 'Could not connect. Ensure signal-cli is running and the URL is correct.'];
}

// --- Save detected API type to config ---
function saveApiType($cfgFile, $type, $account = '') {
    $cfg = @parse_ini_file($cfgFile) ?: [];
    $cfg['API_TYPE'] = $type;
    $cfg['ACCOUNT_NUMBER'] = $account;
    $lines = [];
    foreach ($cfg as $k => $v) {
        $lines[] = "$k=\"$v\"";
    }
    @mkdir(dirname($cfgFile), 0755, true);
    file_put_contents($cfgFile, implode("\n", $lines) . "\n");
}

// --- Read API type from config ---
function getApiType($cfgFile) {
    $cfg = @parse_ini_file($cfgFile);
    return [
        'type'    => $cfg['API_TYPE'] ?? 'asamk',
        'account' => $cfg['ACCOUNT_NUMBER'] ?? '',
    ];
}

switch ($action) {
    case 'test':
        $detect = detectApiType($url);
        if (isset($detect['error']) && empty($detect['type'])) {
            echo json_encode(['success' => false, 'message' => $detect['error']]);
            break;
        }
        if (isset($detect['error'])) {
            // Partial detection (e.g. bbernhard but no account)
            echo json_encode(['success' => false, 'message' => $detect['error'], 'apiType' => $detect['type']]);
            break;
        }
        saveApiType($cfgFile, $detect['type'], $detect['account']);

        if ($detect['type'] === 'bbernhard') {
            // Count groups via REST
            $grpResult = signalRest($url, 'GET', '/v1/groups/' . urlencode($detect['account']));
            $count = 0;
            if (!isset($grpResult['error']) && $grpResult['httpCode'] === 200 && is_array($grpResult['data'])) {
                $count = count($grpResult['data']);
            }
            echo json_encode(['success' => true, 'message' => "Connected. Found $count group(s).", 'apiType' => 'bbernhard']);
        } else {
            $result = signalRpc($rpcUrl, 'listGroups');
            if (isset($result['error'])) {
                echo json_encode(['success' => false, 'message' => $result['error']]);
            } else {
                $count = count($result['result'] ?? []);
                echo json_encode(['success' => true, 'message' => "Connected. Found $count group(s).", 'apiType' => 'asamk']);
            }
        }
        break;

    case 'listGroups':
        $api = getApiType($cfgFile);
        if ($api['type'] === 'bbernhard') {
            $account = $api['account'];
            if (empty($account)) {
                echo json_encode(['error' => 'No account number configured. Re-test the connection.']);
                break;
            }
            $result = signalRest($url, 'GET', '/v1/groups/' . urlencode($account));
            if (isset($result['error'])) {
                echo json_encode(['error' => $result['error']]);
                break;
            }
            if ($result['httpCode'] !== 200) {
                echo json_encode(['error' => "HTTP {$result['httpCode']} from signal-cli-rest-api"]);
                break;
            }
            $groups = [];
            foreach ($result['data'] ?? [] as $group) {
                if (isset($group['blocked']) && $group['blocked']) continue;
                $groups[] = [
                    'id'   => $group['id'] ?? $group['internal_id'] ?? '',
                    'name' => $group['name'] ?? '(unnamed group)',
                ];
            }
            usort($groups, function($a, $b) { return strcasecmp($a['name'], $b['name']); });
            echo json_encode(['groups' => $groups]);
        } else {
            // asamk JSON-RPC
            $result = signalRpc($rpcUrl, 'listGroups');
            if (isset($result['error'])) {
                echo json_encode(['error' => $result['error']]);
                break;
            }
            $groups = [];
            foreach ($result['result'] ?? [] as $group) {
                if (isset($group['isMember']) && !$group['isMember']) continue;
                if (isset($group['isBlocked']) && $group['isBlocked']) continue;
                $groups[] = [
                    'id'   => $group['id'] ?? '',
                    'name' => $group['name'] ?? '(unnamed group)',
                ];
            }
            usort($groups, function($a, $b) { return strcasecmp($a['name'], $b['name']); });
            echo json_encode(['groups' => $groups]);
        }
        break;

    case 'createGroup':
        $name = trim($_POST['name'] ?? '');
        $members = array_filter(array_map('trim', explode(',', $_POST['members'] ?? '')));
        if (empty($name)) {
            echo json_encode(['error' => 'Group name is required']);
            break;
        }
        $api = getApiType($cfgFile);
        if ($api['type'] === 'bbernhard') {
            $account = $api['account'];
            if (empty($account)) {
                echo json_encode(['error' => 'No account number configured. Re-test the connection.']);
                break;
            }
            $body = ['name' => $name];
            if (!empty($members)) {
                $body['members'] = $members;
            }
            $result = signalRest($url, 'POST', '/v1/groups/' . urlencode($account), $body);
            if (isset($result['error'])) {
                echo json_encode(['error' => $result['error']]);
            } elseif ($result['httpCode'] >= 200 && $result['httpCode'] < 300) {
                $groupId = $result['data']['id'] ?? '';
                echo json_encode(['success' => true, 'groupId' => $groupId, 'name' => $name]);
            } else {
                $msg = $result['data']['error'] ?? $result['raw'] ?? "HTTP {$result['httpCode']}";
                echo json_encode(['error' => "Failed to create group: $msg"]);
            }
        } else {
            // asamk JSON-RPC
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
        }
        break;

    case 'sendTest':
        $groupId = $_POST['groupId'] ?? '';
        if (empty($groupId)) {
            echo json_encode(['error' => 'No group selected']);
            break;
        }
        $hostname = gethostname();
        $api = getApiType($cfgFile);
        if ($api['type'] === 'bbernhard') {
            $account = $api['account'];
            if (empty($account)) {
                echo json_encode(['error' => 'No account number configured. Re-test the connection.']);
                break;
            }
            $body = [
                'message'    => "$hostname: Signal notification test from Unraid plugin.",
                'number'     => $account,
                'recipients' => [$groupId],
            ];
            $result = signalRest($url, 'POST', '/v2/send', $body);
            if (isset($result['error'])) {
                echo json_encode(['error' => $result['error']]);
            } elseif ($result['httpCode'] >= 200 && $result['httpCode'] < 300) {
                echo json_encode(['success' => true, 'message' => 'Test message sent!']);
            } else {
                $msg = $result['data']['error'] ?? $result['raw'] ?? "HTTP {$result['httpCode']}";
                echo json_encode(['error' => "Send failed: $msg"]);
            }
        } else {
            // asamk JSON-RPC
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
        }
        break;

    default:
        echo json_encode(['error' => 'Unknown action']);
}
