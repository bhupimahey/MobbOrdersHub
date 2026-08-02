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

    public function client(): PendingRequest
    {
        $verifySsl = (bool) Setting::getValue('spire_verify_ssl', false);

        return Http::baseUrl($this->baseUrl())
            ->withBasicAuth($this->username(), $this->password())
            ->acceptJson()
            ->asJson()
            ->timeout(12)
            ->connectTimeout(5)
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

    public function testConnection(): array
    {
        if (! $this->configured()) {
            return [
                'success' => false,
                'message' => 'Spire settings are incomplete. Set base URL, company, username, and password.',
            ];
        }

        $resolvedIp = $this->resolveHostIp();
        if ($resolvedIp !== null && $this->isPrivateIp($resolvedIp)) {
            return [
                'success' => false,
                'message' => 'Spire host resolves to private LAN IP '.$resolvedIp
                    .' — that address is not reachable from GreenGeeks/the public internet, '
                    .'even if IP 67.208.45.68 is whitelisted. Ask Spire/IT for a public hostname or public IP '
                    .'(port TCP 10880) that routes from outside the office LAN, then update Spire Base URL. '
                    .'Until then keep Mock Orders enabled on production/local.',
                'resolved_ip' => $resolvedIp,
                'base_url' => $this->baseUrl(),
            ];
        }

        try {
            $response = $this->get('/api/v2/companies/');

            if ($response->status() === 401 || $response->status() === 403) {
                return [
                    'success' => false,
                    'message' => 'Authentication failed. Check Spire username and password.',
                    'status' => $response->status(),
                ];
            }

            if (! $response->successful()) {
                Log::warning('Spire connection test failed', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return [
                    'success' => false,
                    'message' => 'Spire API responded with HTTP '.$response->status().'. Check host, port, and firewall.',
                    'status' => $response->status(),
                ];
            }

            $orders = $this->get($this->companyPath('sales/orders/'), [
                'start' => 0,
                'limit' => 1,
            ]);

            if (! $orders->successful()) {
                return [
                    'success' => false,
                    'message' => 'Connected to Spire, but company "'.$this->company().'" orders failed (HTTP '.$orders->status().').',
                    'status' => $orders->status(),
                ];
            }

            self::flushOrderCache();
            $count = $orders->json('count');

            return [
                'success' => true,
                'message' => 'Connected to Spire successfully'
                    .($count !== null ? " (orders available: {$count})" : '')
                    .'.',
                'company' => $this->company(),
                'base_url' => $this->baseUrl(),
                'resolved_ip' => $resolvedIp,
            ];
        } catch (\Throwable $e) {
            Log::error('Spire connection test exception', ['error' => $e->getMessage()]);

            $msg = $e->getMessage();
            $friendly = 'Could not reach Spire API.';

            if (str_contains($msg, 'timed out') || str_contains($msg, 'Timeout') || str_contains($msg, 'Failed to connect')) {
                $ipNote = $resolvedIp ? " (DNS currently resolves to {$resolvedIp})" : '';
                $friendly = 'Connection timed out to '.$this->baseUrl().$ipNote
                    .' on port 10880. Confirm Spire exposes a public IP/hostname (not only office LAN), '
                    .'and that GreenGeeks outbound IP 67.208.45.68 is allowlisted for TCP 10880. '
                    .'If you tested from your PC at home, that will still fail — test from production Settings.';
            } elseif (str_contains($msg, 'SSL') || str_contains($msg, 'certificate')) {
                $friendly = 'SSL error talking to Spire. Keep “Verify Spire SSL Certificate” disabled if Spire uses a self-signed cert.';
            }

            return [
                'success' => false,
                'message' => $friendly,
                'detail' => $msg,
                'resolved_ip' => $resolvedIp,
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
