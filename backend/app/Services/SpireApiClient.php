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
     * Deep office-network Spire probe (same idea as Magento sync: server must reach Spire).
     * Always attempts the call — private LAN IPs work when this PHP process is on office network.
     */
    public function testConnection(): array
    {
        if (! $this->configured()) {
            return [
                'success' => false,
                'message' => 'Spire settings are incomplete. Set base URL, company, username, and password.',
                'steps' => [],
            ];
        }

        $host = (string) parse_url($this->baseUrl(), PHP_URL_HOST);
        $port = (int) (parse_url($this->baseUrl(), PHP_URL_PORT) ?: 10880);
        $resolvedIp = $this->resolveHostIp();
        $onPrivateLan = $resolvedIp !== null && $this->isPrivateIp($resolvedIp);
        $steps = [];

        $steps[] = [
            'name' => 'dns',
            'label' => 'Resolve Spire host',
            'ok' => $resolvedIp !== null,
            'detail' => $resolvedIp
                ? "{$host} → {$resolvedIp}".($onPrivateLan ? ' (office LAN)' : ' (public)')
                : "Could not resolve {$host}",
        ];

        if ($resolvedIp === null) {
            return [
                'success' => false,
                'message' => "Could not resolve Spire host \"{$host}\". Check Spire Base URL.",
                'steps' => $steps,
                'base_url' => $this->baseUrl(),
                'company' => $this->company(),
            ];
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

        if (! $tcpOk) {
            return [
                'success' => false,
                'message' => $onPrivateLan
                    ? "Cannot reach Spire at {$resolvedIp}:{$port}. Spire is office-LAN only — run Orders Hub backend on office Wi‑Fi/VPN (same as Magento sync), then retry Test Spire Connection. GreenGeeks hosting cannot reach this LAN address."
                    : "Cannot reach Spire at {$resolvedIp}:{$port}. Check firewall allowlist for this server’s outbound IP and that port {$port} is open.",
                'steps' => $steps,
                'resolved_ip' => $resolvedIp,
                'base_url' => $this->baseUrl(),
                'company' => $this->company(),
                'office_lan_only' => $onPrivateLan,
            ];
        }

        try {
            $response = $this->client(20, 8)->get('/api/v2/companies/');

            if ($response->status() === 401 || $response->status() === 403) {
                $steps[] = [
                    'name' => 'auth',
                    'label' => 'Basic Auth',
                    'ok' => false,
                    'detail' => 'HTTP '.$response->status().' — check Spire username/password',
                ];

                return [
                    'success' => false,
                    'message' => 'Reached Spire, but authentication failed. Check Spire username and password.',
                    'status' => $response->status(),
                    'steps' => $steps,
                    'resolved_ip' => $resolvedIp,
                    'base_url' => $this->baseUrl(),
                    'company' => $this->company(),
                ];
            }

            if (! $response->successful()) {
                $steps[] = [
                    'name' => 'api',
                    'label' => 'API v2 /companies',
                    'ok' => false,
                    'detail' => 'HTTP '.$response->status(),
                ];

                return [
                    'success' => false,
                    'message' => 'Spire API responded with HTTP '.$response->status().'. Check host, port, and API version (v2).',
                    'status' => $response->status(),
                    'steps' => $steps,
                    'resolved_ip' => $resolvedIp,
                    'base_url' => $this->baseUrl(),
                ];
            }

            $steps[] = [
                'name' => 'auth',
                'label' => 'Basic Auth + API v2',
                'ok' => true,
                'detail' => 'Authenticated to Spire companies endpoint',
            ];

            $orders = $this->client(20, 8)->get($this->companyPath('sales/orders/'), [
                'start' => 0,
                'limit' => 3,
            ]);

            if (! $orders->successful()) {
                $steps[] = [
                    'name' => 'orders',
                    'label' => 'Company orders ('.$this->company().')',
                    'ok' => false,
                    'detail' => 'HTTP '.$orders->status(),
                ];

                return [
                    'success' => false,
                    'message' => 'Connected to Spire, but company "'.$this->company().'" orders failed (HTTP '.$orders->status().').',
                    'status' => $orders->status(),
                    'steps' => $steps,
                    'resolved_ip' => $resolvedIp,
                    'base_url' => $this->baseUrl(),
                    'company' => $this->company(),
                ];
            }

            $count = $orders->json('count');
            $records = $orders->json('records') ?? [];
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

            if ($onPrivateLan) {
                $message .= ' Connected over office LAN. Live Spire only works while this backend runs on office network/VPN (Magento-style). Keep Mock Orders on for GreenGeeks hosting.';
            }

            return [
                'success' => true,
                'message' => $message,
                'company' => $this->company(),
                'base_url' => $this->baseUrl(),
                'resolved_ip' => $resolvedIp,
                'office_lan_only' => $onPrivateLan,
                'order_count' => $count,
                'sample_order' => $sampleOrder,
                'steps' => $steps,
            ];
        } catch (\Throwable $e) {
            Log::error('Spire connection test exception', ['error' => $e->getMessage()]);

            $msg = $e->getMessage();
            $friendly = 'Could not reach Spire API.';

            if (str_contains($msg, 'timed out') || str_contains($msg, 'Timeout') || str_contains($msg, 'Failed to connect')) {
                $friendly = $onPrivateLan
                    ? "Timed out reaching {$this->baseUrl()} ({$resolvedIp}:{$port}). You are not on the office network from this server. Open Orders Hub on an office PC (npm start / php artisan serve), turn Mock Orders off, save Spire credentials, then click Test Spire Connection again."
                    : "Connection timed out to {$this->baseUrl()} on port {$port}. Check firewall and that this server can reach Spire.";
            } elseif (str_contains($msg, 'SSL') || str_contains($msg, 'certificate')) {
                $friendly = 'SSL error talking to Spire. Keep “Verify Spire SSL Certificate” disabled if Spire uses a self-signed cert.';
            }

            $steps[] = [
                'name' => 'api',
                'label' => 'HTTPS API call',
                'ok' => false,
                'detail' => $msg,
            ];

            return [
                'success' => false,
                'message' => $friendly,
                'detail' => $msg,
                'resolved_ip' => $resolvedIp,
                'office_lan_only' => $onPrivateLan,
                'steps' => $steps,
                'base_url' => $this->baseUrl(),
                'company' => $this->company(),
            ];
        }
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
