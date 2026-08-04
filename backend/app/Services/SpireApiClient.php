<?php

namespace App\Services;

use App\Models\Setting;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SpireApiClient
{
    public function configured(): bool
    {
        return $this->baseUrl() !== ''
            && $this->company() !== ''
            && $this->username() !== ''
            && $this->password() !== '';
    }

    public function baseUrl(): string
    {
        return rtrim((string) Setting::getValue('spire_base_url', ''), '/');
    }

    public function company(): string
    {
        return trim((string) Setting::getValue('spire_company', ''));
    }

    public function username(): string
    {
        return (string) Setting::getValue('spire_username', '');
    }

    public function password(): string
    {
        return (string) Setting::getValue('spire_password', '');
    }

    public function companyPath(string $suffix = ''): string
    {
        $suffix = ltrim($suffix, '/');

        return '/api/v2/companies/'.$this->company().($suffix !== '' ? '/'.$suffix : '');
    }

    public function client(?int $timeout = null, ?int $connectTimeout = null): PendingRequest
    {
        $verifySsl = (bool) Setting::getValue('spire_verify_ssl', false);

        return Http::baseUrl($this->baseUrl())
            ->withBasicAuth($this->username(), $this->password())
            ->acceptJson()
            ->asJson()
            ->timeout($timeout ?? 20)
            ->connectTimeout($connectTimeout ?? 8)
            ->withOptions(['verify' => $verifySsl]);
    }

    public function get(string $path, array $query = []): Response
    {
        return $this->client()->get($path, $query);
    }

    public static function flushOrderCache(): void
    {
        // File/array cache: forget known keys; also bump generation for hashed keys
        Cache::forever('spire:cache_gen', (int) Cache::get('spire:cache_gen', 1) + 1);
    }

    private function cacheGen(): int
    {
        return (int) Cache::get('spire:cache_gen', 1);
    }

    /**
     * Deep Spire probe with full request/response log for Spire admin support.
     */
    public function testConnection(): array
    {
        $log = [];
        $startedAt = now()->toIso8601String();

        $pushLog = function (array $entry) use (&$log): void {
            $log[] = $entry;
            Log::info('Spire connection test', $entry);
        };

        if (! $this->configured()) {
            $pushLog([
                'step' => 'config',
                'ok' => false,
                'message' => 'Spire settings incomplete (base URL, company, username, password required).',
            ]);

            return [
                'success' => false,
                'message' => 'Spire settings are incomplete. Set base URL, company, username, and password.',
                'steps' => [],
                'log' => $log,
                'started_at' => $startedAt,
            ];
        }

        $host = (string) parse_url($this->baseUrl(), PHP_URL_HOST);
        $port = (int) (parse_url($this->baseUrl(), PHP_URL_PORT) ?: 10880);
        $resolvedIp = $this->resolveHostIp();
        $onPrivateLan = $resolvedIp !== null && $this->isPrivateIp($resolvedIp);
        $steps = [];
        $auth = [
            'type' => 'Basic Auth',
            'username' => $this->username(),
            'password' => $this->password(),
        ];

        $pushLog([
            'step' => 'settings',
            'ok' => true,
            'base_url' => $this->baseUrl(),
            'company' => $this->company(),
            'api_version' => 'v2',
            'auth' => $auth,
            'verify_ssl' => (bool) Setting::getValue('spire_verify_ssl', false),
        ]);

        $steps[] = [
            'name' => 'dns',
            'label' => 'Resolve Spire host',
            'ok' => $resolvedIp !== null,
            'detail' => $resolvedIp
                ? "{$host} → {$resolvedIp}".($onPrivateLan ? ' (office LAN)' : ' (public)')
                : "Could not resolve {$host}",
        ];
        $pushLog([
            'step' => 'dns',
            'ok' => $resolvedIp !== null,
            'host' => $host,
            'resolved_ip' => $resolvedIp,
            'office_lan' => $onPrivateLan,
        ]);

        if ($resolvedIp === null) {
            return $this->testResult(false, "Could not resolve Spire host \"{$host}\". Check Spire Base URL.", $steps, $log, [
                'base_url' => $this->baseUrl(),
                'company' => $this->company(),
                'started_at' => $startedAt,
            ]);
        }

        $tcpOk = $this->probeTcp($resolvedIp, $port, 5);
        $steps[] = [
            'name' => 'tcp',
            'label' => "TCP connect {$resolvedIp}:{$port}",
            'ok' => $tcpOk,
            'detail' => $tcpOk
                ? 'Port is reachable from this server'
                : 'Port closed/unreachable from this server (need office network or VPN)',
        ];
        $pushLog([
            'step' => 'tcp',
            'ok' => $tcpOk,
            'target' => "{$resolvedIp}:{$port}",
            'timeout_seconds' => 5,
        ]);

        if (! $tcpOk) {
            $message = $onPrivateLan
                ? "Cannot reach Spire at {$resolvedIp}:{$port}. Spire is office-LAN only — run Orders Hub backend on office Wi‑Fi/VPN, then retry."
                : "Cannot reach Spire at {$resolvedIp}:{$port}. Check firewall allowlist and that port {$port} is open.";

            return $this->testResult(false, $message, $steps, $log, [
                'resolved_ip' => $resolvedIp,
                'base_url' => $this->baseUrl(),
                'company' => $this->company(),
                'office_lan_only' => $onPrivateLan,
                'started_at' => $startedAt,
            ]);
        }

        try {
            $companiesPath = '/api/v2/companies/';
            $companiesUrl = $this->baseUrl().$companiesPath;
            $t0 = microtime(true);
            $response = $this->client(20, 8)->get($companiesPath);
            $companiesMs = (int) round((microtime(true) - $t0) * 1000);
            $companiesBody = $this->truncateForLog($response->json() ?? $response->body());

            $pushLog([
                'step' => 'http_request',
                'ok' => $response->successful(),
                'request' => [
                    'method' => 'GET',
                    'url' => $companiesUrl,
                    'path' => $companiesPath,
                    'query' => new \stdClass,
                    'headers' => [
                        'Accept' => 'application/json',
                        'Authorization' => 'Basic '.base64_encode($this->username().':'.$this->password()),
                    ],
                    'auth' => $auth,
                ],
                'response' => [
                    'status' => $response->status(),
                    'duration_ms' => $companiesMs,
                    'body' => $companiesBody,
                ],
            ]);

            if ($response->status() === 401 || $response->status() === 403) {
                $steps[] = [
                    'name' => 'auth',
                    'label' => 'Basic Auth',
                    'ok' => false,
                    'detail' => 'HTTP '.$response->status().' — check Spire username/password',
                ];

                return $this->testResult(false, 'Reached Spire, but authentication failed. Check Spire username and password.', $steps, $log, [
                    'status' => $response->status(),
                    'resolved_ip' => $resolvedIp,
                    'base_url' => $this->baseUrl(),
                    'company' => $this->company(),
                    'started_at' => $startedAt,
                ]);
            }

            if (! $response->successful()) {
                $steps[] = [
                    'name' => 'api',
                    'label' => 'API v2 /companies',
                    'ok' => false,
                    'detail' => 'HTTP '.$response->status(),
                ];

                return $this->testResult(false, 'Spire API responded with HTTP '.$response->status().'. Check host, port, and API version (v2).', $steps, $log, [
                    'status' => $response->status(),
                    'resolved_ip' => $resolvedIp,
                    'base_url' => $this->baseUrl(),
                    'started_at' => $startedAt,
                ]);
            }

            $steps[] = [
                'name' => 'auth',
                'label' => 'Basic Auth + API v2',
                'ok' => true,
                'detail' => 'Authenticated to Spire companies endpoint',
            ];

            $ordersPath = $this->companyPath('sales/orders/');
            $ordersQuery = ['start' => 0, 'limit' => 3];
            $ordersUrl = $this->baseUrl().$ordersPath.'?'.http_build_query($ordersQuery);
            $t1 = microtime(true);
            $orders = $this->client(20, 8)->get($ordersPath, $ordersQuery);
            $ordersMs = (int) round((microtime(true) - $t1) * 1000);
            $ordersJson = $orders->json();
            $ordersBody = $this->truncateForLog($ordersJson ?? $orders->body());

            $pushLog([
                'step' => 'http_request',
                'ok' => $orders->successful(),
                'request' => [
                    'method' => 'GET',
                    'url' => $ordersUrl,
                    'path' => $ordersPath,
                    'query' => $ordersQuery,
                    'headers' => [
                        'Accept' => 'application/json',
                        'Authorization' => 'Basic '.base64_encode($this->username().':'.$this->password()),
                    ],
                    'auth' => $auth,
                ],
                'response' => [
                    'status' => $orders->status(),
                    'duration_ms' => $ordersMs,
                    'body' => $ordersBody,
                ],
            ]);

            if (! $orders->successful()) {
                $steps[] = [
                    'name' => 'orders',
                    'label' => 'Company orders ('.$this->company().')',
                    'ok' => false,
                    'detail' => 'HTTP '.$orders->status(),
                ];

                return $this->testResult(false, 'Connected to Spire, but company "'.$this->company().'" orders failed (HTTP '.$orders->status().').', $steps, $log, [
                    'status' => $orders->status(),
                    'resolved_ip' => $resolvedIp,
                    'base_url' => $this->baseUrl(),
                    'company' => $this->company(),
                    'started_at' => $startedAt,
                ]);
            }

            $count = is_array($ordersJson) ? ($ordersJson['count'] ?? null) : null;
            $records = is_array($ordersJson) ? ($ordersJson['records'] ?? []) : [];
            $sample = is_array($records) && $records !== [] ? $records[0] : null;
            $sampleOrder = null;

            if (is_array($sample)) {
                $sampleOrder = [
                    'id' => $sample['id'] ?? null,
                    'order_no' => $sample['orderNo'] ?? null,
                    'customer' => data_get($sample, 'customer.name')
                        ?? data_get($sample, 'shippingAddress.name')
                        ?? null,
                    'customer_po' => $sample['customerPO'] ?? null,
                    'order_date' => $sample['orderDate'] ?? $sample['created'] ?? null,
                    'status' => $sample['status'] ?? null,
                ];
            }

            $steps[] = [
                'name' => 'orders',
                'label' => 'Fetch sales orders + customer fields',
                'ok' => true,
                'detail' => ($count !== null ? "{$count} orders available" : 'Orders endpoint OK')
                    .($sampleOrder['order_no'] ?? null
                        ? '; sample #'.$sampleOrder['order_no']
                            .($sampleOrder['customer'] ? ' / '.$sampleOrder['customer'] : '')
                        : ''),
            ];

            self::flushOrderCache();

            $message = 'Spire connection OK — API v2, company '.$this->company()
                .($count !== null ? ", {$count} orders" : '')
                .'.';

            return $this->testResult(true, $message, $steps, $log, [
                'company' => $this->company(),
                'base_url' => $this->baseUrl(),
                'resolved_ip' => $resolvedIp,
                'office_lan_only' => $onPrivateLan,
                'order_count' => $count,
                'sample_order' => $sampleOrder,
                'started_at' => $startedAt,
            ]);
        } catch (\Throwable $e) {
            Log::error('Spire connection test exception', ['error' => $e->getMessage()]);

            $msg = $e->getMessage();
            $friendly = 'Could not reach Spire API.';

            if (str_contains($msg, 'timed out') || str_contains($msg, 'Timeout') || str_contains($msg, 'Failed to connect')) {
                $friendly = $onPrivateLan
                    ? "Timed out reaching {$this->baseUrl()} ({$resolvedIp}:{$port}). Run Orders Hub on an office PC/network, then retry Test Spire Connection."
                    : "Connection timed out to {$this->baseUrl()} on port {$port}.";
            } elseif (str_contains($msg, 'SSL') || str_contains($msg, 'certificate')) {
                $friendly = 'SSL error talking to Spire. Keep “Verify Spire SSL Certificate” disabled if Spire uses a self-signed cert.';
            }

            $steps[] = [
                'name' => 'api',
                'label' => 'HTTPS API call',
                'ok' => false,
                'detail' => $msg,
            ];
            $pushLog([
                'step' => 'exception',
                'ok' => false,
                'error' => $msg,
            ]);

            return $this->testResult(false, $friendly, $steps, $log, [
                'detail' => $msg,
                'resolved_ip' => $resolvedIp,
                'office_lan_only' => $onPrivateLan,
                'base_url' => $this->baseUrl(),
                'company' => $this->company(),
                'started_at' => $startedAt,
            ]);
        }
    }

    /**
     * @param  list<array<string, mixed>>  $steps
     * @param  list<array<string, mixed>>  $log
     * @param  array<string, mixed>  $extra
     * @return array<string, mixed>
     */
    private function testResult(bool $success, string $message, array $steps, array $log, array $extra = []): array
    {
        return array_merge([
            'success' => $success,
            'message' => $message,
            'steps' => $steps,
            'log' => $log,
            'finished_at' => now()->toIso8601String(),
        ], $extra);
    }

    private function truncateForLog(mixed $body, int $maxRecords = 3): mixed
    {
        if (is_string($body)) {
            return strlen($body) > 8000 ? substr($body, 0, 8000).'…[truncated]' : $body;
        }

        if (! is_array($body)) {
            return $body;
        }

        if (isset($body['records']) && is_array($body['records']) && count($body['records']) > $maxRecords) {
            $body['records'] = array_slice($body['records'], 0, $maxRecords);
            $body['_records_truncated'] = true;
            $body['_records_shown'] = $maxRecords;
        }

        $encoded = json_encode($body);
        if (is_string($encoded) && strlen($encoded) > 20000) {
            return [
                '_truncated' => true,
                'preview' => substr($encoded, 0, 20000).'…',
            ];
        }

        return $body;
    }

    private function resolveHostIp(): ?string
    {
        $host = parse_url($this->baseUrl(), PHP_URL_HOST);
        if (! is_string($host) || $host === '') {
            return null;
        }

        if (filter_var($host, FILTER_VALIDATE_IP)) {
            return $host;
        }

        $ip = gethostbyname($host);

        return ($ip !== $host && filter_var($ip, FILTER_VALIDATE_IP)) ? $ip : null;
    }

    private function isPrivateIp(string $ip): bool
    {
        if (! filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
            return false;
        }

        return ! filter_var(
            $ip,
            FILTER_VALIDATE_IP,
            FILTER_FLAG_IPV4 | FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE
        );
    }

    private function probeTcp(string $ip, int $port, int $timeoutSeconds = 5): bool
    {
        $errno = 0;
        $errstr = '';
        $socket = @fsockopen($ip, $port, $errno, $errstr, $timeoutSeconds);

        if (! is_resource($socket)) {
            return false;
        }

        fclose($socket);

        return true;
    }

    public function listSalesOrders(array $query = []): array
    {
        $query = array_merge([
            'start' => 0,
            'limit' => 50,
        ], $query);

        $cacheKey = 'spire:orders:'.$this->cacheGen().':'.md5(json_encode($query).'|'.$this->company());

        return Cache::remember($cacheKey, 45, function () use ($query) {
            $response = $this->get($this->companyPath('sales/orders/'), $query);

            if (! $response->successful()) {
                Log::warning('Spire list sales orders failed', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return [
                    'records' => [],
                    'error' => 'Failed to fetch sales orders from Spire (HTTP '.$response->status().').',
                    'status' => $response->status(),
                ];
            }

            $payload = $response->json() ?? [];

            return [
                'records' => $payload['records'] ?? [],
                'count' => $payload['count'] ?? null,
                'start' => $payload['start'] ?? 0,
                'limit' => $payload['limit'] ?? null,
            ];
        });
    }

    public function getSalesOrder(string|int $orderId): ?array
    {
        $cacheKey = 'spire:order:'.$this->cacheGen().':'.$this->company().':'.$orderId;

        return Cache::remember($cacheKey, 60, function () use ($orderId) {
            $response = $this->get($this->companyPath('sales/orders/'.$orderId));

            if (! $response->successful()) {
                Log::warning('Spire get sales order failed', [
                    'order_id' => $orderId,
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return null;
            }

            return $response->json();
        });
    }

    /**
     * Best-effort order items. Pass $detail to avoid a second Spire round-trip.
     */
    public function getSalesOrderItems(string|int $orderId, ?string $orderNo = null, ?array $detail = null): array
    {
        $detail ??= $this->getSalesOrder($orderId);

        if (is_array($detail)) {
            foreach (['items', 'items.records', 'salesItems'] as $key) {
                $items = data_get($detail, $key);
                if (is_array($items) && $items !== [] && array_is_list($items)) {
                    return $items;
                }
                if (is_array($items) && isset($items['records']) && is_array($items['records'])) {
                    return $items['records'];
                }
            }
        }

        // Skip extra items API on list pages — only when explicitly needed
        return [];
    }
}
