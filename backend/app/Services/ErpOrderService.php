<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\OrderPhase;
use App\Models\Setting;
use App\Models\User;
use App\Support\SpireCompany;
use Illuminate\Support\Facades\Log;

class ErpOrderService
{
    public function __construct(
        private readonly SpireApiClient $spire,
        private readonly SpireOrderMapper $mapper,
    ) {}

    /**
     * Scope subsequent Spire calls to a Hub company slug or Spire ID for this request.
     */
    public function usingCompany(?string $slugOrId): void
    {
        if ($slugOrId === null || trim($slugOrId) === '') {
            $this->spire->useCompany(null);

            return;
        }

        $this->spire->useCompany(SpireCompany::resolveId($slugOrId));
    }

    public function listOrders(?User $user = null, array $filters = []): array
    {
        $this->usingCompany($filters['company'] ?? null);

        try {
            return $this->listOrdersInternal($user, $filters);
        } finally {
            $this->usingCompany(null);
        }
    }

    private function listOrdersInternal(?User $user, array $filters): array
    {
        $fresh = ! empty($filters['fresh']);

        if ($this->useMock()) {
            $orders = $this->mockOrders();
            $filtered = $this->filterForUser($orders, $user, $filters);
            $limit = max(1, min(200, (int) ($filters['limit'] ?? 50)));
            $page = max(1, (int) ($filters['page'] ?? 1));
            $filtered['meta'] = array_merge($filtered['meta'] ?? [], [
                'page' => $page,
                'per_page' => $limit,
                'spire_company' => $this->spire->company(),
            ]);

            return $filtered;
        }

        if (! $this->spire->configured()) {
            return [
                'data' => [],
                'meta' => [
                    'count' => 0,
                    'using_mock' => false,
                    'error' => 'Spire API is not configured. Add credentials in Settings.',
                    'spire_company' => $this->spire->company(),
                ],
            ];
        }

        if ($fresh) {
            SpireApiClient::flushOrderCache();
        }

        // Pull enough open SOs for year-to-date listings. Spire often returns oldest-first;
        // listRecentSalesOrders merges head+tail pages so current HHC/MOBB orders are not buried.
        $limit = max(1, min(500, (int) ($filters['limit'] ?? 200)));
        $page = max(1, (int) ($filters['page'] ?? 1));
        $start = ($page - 1) * $limit;

        $search = ! empty($filters['search']) ? (string) $filters['search'] : null;
        $result = $this->spire->listRecentSalesOrders($limit, $fresh, $search);

        if (! empty($result['error'])) {
            return [
                'data' => [],
                'meta' => [
                    'count' => 0,
                    'page' => $page,
                    'per_page' => $limit,
                    'using_mock' => false,
                    'error' => $result['error'],
                    'spire_company' => $this->spire->company(),
                ],
            ];
        }

        $records = $result['records'] ?? [];
        // Map with embedded items when Spire list includes them (detail JSON does).
        $orders = array_map(
            fn (array $row) => $this->mapper->mapOrder($row, $row['items'] ?? []),
            $records
        );

        // Invoiced docs leave sales/orders — merge Sales History so Hub matches Spire Invoices list.
        // Cover Orders presets (This year / Last 6 months) by Invoice Date, not only "today".
        $tz = new \DateTimeZone('America/Toronto');
        $today = new \DateTimeImmutable('now', $tz);
        $sixMonthsAgo = $today->modify('-6 months')->format('Y-m-d');
        $yearStart = $today->format('Y').'-01-01';
        $invoiceFrom = min($sixMonthsAgo, $yearStart);
        $invoiceTo = $today->format('Y-m-d');
        $invoiceResult = $this->spire->listInvoicesBetween($invoiceFrom, $invoiceTo, 500, $fresh);
        $invoiceOrders = [];
        foreach ($invoiceResult['records'] ?? [] as $row) {
            if (! is_array($row)) {
                continue;
            }
            $invoiceOrders[] = $this->mapper->mapInvoice($row, $row['items'] ?? []);
        }

        $orders = $this->mergeOrdersPreferringInvoices($orders, $invoiceOrders);

        $filtered = $this->filterForUser($orders, $user, $filters);
        $spireCount = $result['count'] ?? null;
        $todayYmd = $today->format('Y-m-d');
        $invoicesToday = collect($invoiceOrders)->filter(function ($o) use ($todayYmd) {
            $day = substr((string) ($o['invoice_date'] ?? $o['order_date'] ?? ''), 0, 10);

            return $day === $todayYmd;
        })->count();

        $filtered['meta'] = array_merge($filtered['meta'] ?? [], [
            'page' => $page,
            'per_page' => $limit,
            'spire_count' => $spireCount,
            'invoice_count' => count($invoiceOrders),
            'invoice_count_today' => $invoicesToday,
            'invoice_from' => $invoiceFrom,
            'invoice_to' => $invoiceTo,
            'start' => $start,
            'fresh' => $fresh,
            'invoice_error' => $invoiceResult['error'] ?? null,
            'spire_company' => $this->spire->company(),
        ]);

        return $filtered;
    }

    /**
     * Prefer invoice-mapped rows when the same order/invoice appears in both collections.
     *
     * @param  array<int, array<string, mixed>>  $orders
     * @param  array<int, array<string, mixed>>  $invoiceOrders
     * @return array<int, array<string, mixed>>
     */
    private function mergeOrdersPreferringInvoices(array $orders, array $invoiceOrders): array
    {
        $byKey = [];

        foreach ($orders as $order) {
            $key = $this->orderMergeKey($order);
            $byKey[$key] = $order;
        }

        foreach ($invoiceOrders as $order) {
            $key = $this->orderMergeKey($order);
            $byKey[$key] = $order;
        }

        return array_values($byKey);
    }

    private function orderMergeKey(array $order): string
    {
        $orderNo = trim((string) ($order['order_number'] ?? ''));
        if ($orderNo !== '') {
            return 'no:'.$orderNo;
        }

        return 'id:'.(string) ($order['id'] ?? uniqid('o', true));
    }

    /**
     * Full raw Spire sales-order JSON (for admin cross-check).
     */
    public function getRawOrder(string $orderId): ?array
    {
        if ($this->useMock()) {
            $mapped = collect($this->mockOrders())->firstWhere('id', $orderId)
                ?? collect($this->mockOrders())->firstWhere('order_number', $orderId);

            return $mapped ? [
                'source' => 'mock',
                'order' => $mapped,
            ] : null;
        }

        if (! $this->spire->configured()) {
            return null;
        }

        $raw = $this->spire->getSalesOrderFresh($orderId);
        if (! $raw) {
            $list = $this->spire->listSalesOrders(['q' => $orderId, 'limit' => 5], true);
            $match = collect($list['records'] ?? [])->first(function ($row) use ($orderId) {
                return (string) ($row['id'] ?? '') === $orderId
                    || (string) ($row['orderNo'] ?? '') === $orderId;
            });
            if (is_array($match) && ! empty($match['id'])) {
                $raw = $this->spire->getSalesOrderFresh((string) $match['id']) ?? $match;
            } else {
                $raw = is_array($match) ? $match : null;
            }
        }

        $source = 'spire_order';
        if (! is_array($raw)) {
            $raw = $this->findInvoiceRaw($orderId, true);
            $source = is_array($raw) ? 'spire_invoice' : $source;
        }

        if (! is_array($raw)) {
            return null;
        }

        // Bust list cache so the next orders listing remaps with latest phaseId.
        SpireApiClient::flushOrderCache();

        $mapped = $source === 'spire_invoice'
            ? $this->mapper->mapInvoice($raw, $raw['items'] ?? [])
            : $this->mapper->mapOrder($raw, $raw['items'] ?? []);

        return [
            'source' => $source,
            'order_id' => $raw['id'] ?? $orderId,
            'order_no' => $raw['orderNo'] ?? null,
            'mapped_phase' => $mapped['current_phase'] ?? null,
            'order' => $raw,
        ];
    }

    public function getOrder(string $orderId, ?string $company = null): ?array
    {
        $this->usingCompany($company);
        try {
            return $this->getOrderInternal($orderId);
        } finally {
            $this->usingCompany(null);
        }
    }

    private function getOrderInternal(string $orderId): ?array
    {
        if ($this->useMock()) {
            return collect($this->mockOrders())->firstWhere('id', $orderId)
                ?? collect($this->mockOrders())->firstWhere('order_number', $orderId);
        }

        if (! $this->spire->configured()) {
            return null;
        }

        $raw = $this->spire->getSalesOrder($orderId, true);
        if (! $raw) {
            // Try search by order number if numeric id lookup failed
            $list = $this->spire->listSalesOrders(['q' => $orderId, 'limit' => 5], true);
            $raw = collect($list['records'] ?? [])->first(function ($row) use ($orderId) {
                return (string) ($row['id'] ?? '') === $orderId
                    || (string) ($row['orderNo'] ?? '') === $orderId;
            });
        }

        if (is_array($raw)) {
            $items = $this->spire->getSalesOrderItems($raw['id'] ?? $orderId, $raw['orderNo'] ?? null, $raw);

            return $this->mapper->mapOrder($raw, $items);
        }

        // Invoiced orders leave sales/orders — resolve from sales/invoices.
        $invoice = $this->findInvoiceRaw($orderId, true);
        if (! is_array($invoice)) {
            return null;
        }

        $items = $this->spire->getSalesInvoiceItems($invoice['id'] ?? $orderId, $invoice);

        return $this->mapper->mapInvoice($invoice, $items);
    }

    /**
     * Locate a Spire invoice by id, invoiceNo, or original orderNo.
     */
    private function findInvoiceRaw(string $orderId, bool $fresh = false): ?array
    {
        $direct = $fresh
            ? $this->spire->getSalesInvoiceFresh($orderId)
            : $this->spire->getSalesInvoice($orderId);
        if (is_array($direct)) {
            return $direct;
        }

        $list = $this->spire->listSalesInvoices(['q' => $orderId, 'limit' => 10], $fresh);
        $match = collect($list['records'] ?? [])->first(function ($row) use ($orderId) {
            if (! is_array($row)) {
                return false;
            }

            return (string) ($row['id'] ?? '') === $orderId
                || (string) ($row['invoiceNo'] ?? '') === $orderId
                || (string) ($row['orderNo'] ?? '') === $orderId
                || (string) ($row['salesOrderNo'] ?? '') === $orderId;
        });

        if (! is_array($match)) {
            return null;
        }

        if (! empty($match['id'])) {
            return ($fresh
                ? $this->spire->getSalesInvoiceFresh((string) $match['id'])
                : $this->spire->getSalesInvoice((string) $match['id'])) ?? $match;
        }

        return $match;
    }

    public function getStatus(string $orderId): ?array
    {
        $order = $this->getOrder($orderId);

        return $order ? [
            'order_number' => $order['order_number'],
            'current_phase' => $order['current_phase'],
            'current_phase_index' => $order['current_phase_index'],
            'skipped_phases' => $order['skipped_phases'] ?? [],
            'conditions' => $order['conditions'] ?? [],
        ] : null;
    }

    public function updateOrder(string $orderId, array $payload, User $user): array
    {
        $previous = $this->getStatus($orderId);
        $previousStatus = $previous['current_phase'] ?? null;

        if ($this->useMock()) {
            $result = [
                'success' => true,
                'order_number' => $orderId,
                'updated' => $payload,
                'mock' => true,
            ];
        } else {
            // Phase 2: read-focused. Local activity is still logged; Spire write actions come next.
            $result = [
                'success' => true,
                'order_number' => $orderId,
                'updated' => $payload,
                'spire' => true,
                'note' => 'Order action logged locally. Spire write-back (invoice/status) can be enabled next.',
            ];
        }

        $phaseCode = $payload['phase_code'] ?? $payload['current_phase'] ?? null;
        $phase = $phaseCode
            ? OrderPhase::query()->where('code', $phaseCode)->first()
            : null;

        ActivityLog::query()->create([
            'user_id' => $user->id,
            'order_reference' => $orderId,
            'phase_id' => $phase?->id,
            'phase_code' => $phaseCode,
            'action' => $payload['action'] ?? 'update_order',
            'previous_status' => $previousStatus,
            'updated_status' => $payload['updated_status'] ?? $phaseCode,
            'details' => $payload,
            'ip_address' => request()->ip(),
        ]);

        return $result;
    }

    public function testSpireConnection(): array
    {
        return $this->spire->testConnection();
    }

    public function dashboardSummary(?User $user = null, ?string $company = null): array
    {
        // Same list window as Orders page so counters and row counts stay aligned.
        $result = $this->listOrders($user, [
            'limit' => 500,
            'page' => 1,
            'fresh' => true,
            'company' => $company ?? SpireCompany::DEFAULT_SLUG,
        ]);
        $orders = $result['data'] ?? [];

        $sortedOrders = collect($orders)
            ->sortByDesc(fn ($o) => $o['order_date'] ?? $o['last_updated'] ?? '')
            ->values()
            ->all();

        $all = collect($sortedOrders);
        $todayYmd = (new \DateTimeImmutable('now', new \DateTimeZone('America/Toronto')))->format('Y-m-d');

        $isInvoiced = function (array $o): bool {
            return ($o['current_phase'] ?? '') === 'invoiced'
                || ($o['current_phase'] ?? '') === 'completed'
                || (($o['spire']['source'] ?? null) === 'invoice');
        };

        $listingDay = function (array $o) use ($isInvoiced): string {
            if ($isInvoiced($o)) {
                return substr((string) ($o['invoice_date'] ?? $o['order_date'] ?? ''), 0, 10);
            }

            return substr((string) ($o['order_date'] ?? ''), 0, 10);
        };

        // Open workflow = still in Hub phases (not Sales History / Invoiced).
        $openWorkflow = $all->filter(fn ($o) => ! $isInvoiced($o));
        $invoiced = $all->filter(fn ($o) => $isInvoiced($o));

        // Total Orders must match the listing row count (open + all Sales History in window).
        $totalOrders = $all->count();

        $inProgress = $openWorkflow
            ->where('is_completed', false)
            ->where('is_delayed', false)
            ->count();

        $completedToday = $all->filter(function ($o) use ($todayYmd, $isInvoiced, $listingDay) {
            if (! empty($o['completed_today'])) {
                return true;
            }

            return $isInvoiced($o) && $listingDay($o) === $todayYmd;
        })->count();

        $delayed = $openWorkflow->where('is_delayed', true)->count();

        $salesHistoryToday = $invoiced->filter(
            fn ($o) => $listingDay($o) === $todayYmd
        )->count();

        // Ordered today (open workflow by order date).
        $todayOrders = $openWorkflow->filter(
            fn ($o) => str_starts_with((string) ($o['order_date'] ?? ''), $todayYmd)
        )->count();

        // Conditions across the full listing (open + invoiced), matching what users see in the table.
        $conditions = [
            'on_hold' => $all->filter(fn ($o) => in_array('On Hold', $o['conditions'] ?? [], true))->count(),
            'backordered' => $all->filter(fn ($o) => in_array('Backordered', $o['conditions'] ?? [], true))->count(),
            'cancelled' => $all->filter(fn ($o) => in_array('Cancelled', $o['conditions'] ?? [], true))->count(),
            'customer_pickup' => $all->filter(fn ($o) => in_array('Customer Pickup', $o['conditions'] ?? [], true))->count(),
        ];

        $usingMock = $this->useMock();

        return [
            'stats' => [
                'total_orders' => $usingMock ? ($totalOrders ?: 128) : $totalOrders,
                'in_progress' => $usingMock ? ($inProgress ?: 42) : $inProgress,
                'completed_today' => $usingMock ? ($completedToday ?: 96) : $completedToday,
                'delayed_orders' => $usingMock ? ($delayed ?: 5) : $delayed,
                'today_orders' => $usingMock ? ($todayOrders ?: 13) : $todayOrders,
                'sales_history_today' => $usingMock ? ($salesHistoryToday ?: 4) : $salesHistoryToday,
                'sales_history_total' => $usingMock ? ($invoiced->count() ?: 4) : $invoiced->count(),
                'open_workflow' => $usingMock ? ($openWorkflow->count() ?: 100) : $openWorkflow->count(),
            ],
            'conditions' => [
                'on_hold' => $usingMock ? ($conditions['on_hold'] ?: 8) : $conditions['on_hold'],
                'backordered' => $usingMock ? ($conditions['backordered'] ?: 8) : $conditions['backordered'],
                'cancelled' => $usingMock ? ($conditions['cancelled'] ?: 8) : $conditions['cancelled'],
                'customer_pickup' => $usingMock ? ($conditions['customer_pickup'] ?: 6) : $conditions['customer_pickup'],
            ],
            'today' => [
                'orders_received' => $usingMock ? 32 : $todayOrders,
                'orders_in_progress' => $usingMock ? ($inProgress ?: 42) : $inProgress,
                'orders_completed' => $usingMock ? ($completedToday ?: 96) : $completedToday,
                'delayed_orders' => $usingMock ? ($delayed ?: 5) : $delayed,
            ],
            'orders' => $sortedOrders,
            'using_mock' => $usingMock,
            'error' => $result['meta']['error'] ?? null,
        ];
    }

    private function filterForUser(array $orders, ?User $user, array $filters = []): array
    {
        $collection = collect($orders);

        if ($user && $user->isStaff()) {
            $codes = $user->assignedPhaseCodes();
            $collection = $collection->filter(function ($order) use ($codes) {
                // Sales History / Invoiced always visible — not gated by staff phase assignment.
                if ($this->isInvoicedListingOrder($order)) {
                    return true;
                }

                return in_array($order['current_phase'] ?? '', $codes, true);
            })->values();
        }

        if (! empty($filters['status']) && $filters['status'] !== 'all') {
            $status = (string) $filters['status'];
            if (str_starts_with($status, 'cond:')) {
                $label = substr($status, 5);
                $collection = $collection->filter(
                    fn ($o) => in_array($label, $o['conditions'] ?? [], true)
                )->values();
            } else {
                $collection = $collection->filter(fn ($o) => ($o['current_phase'] ?? '') === $status)->values();
            }
        }

        if (! empty($filters['search'])) {
            $search = strtolower($filters['search']);
            $collection = $collection->filter(function ($o) use ($search) {
                return str_contains(strtolower($o['order_number'] ?? ''), $search)
                    || str_contains(strtolower($o['customer'] ?? ''), $search);
            })->values();
        }

        if (! empty($filters['date_from']) || ! empty($filters['date_to'])) {
            $from = ! empty($filters['date_from']) ? substr((string) $filters['date_from'], 0, 10) : null;
            $to = ! empty($filters['date_to']) ? substr((string) $filters['date_to'], 0, 10) : null;

            $collection = $collection->filter(function ($o) use ($from, $to) {
                $orderDate = substr((string) ($o['order_date'] ?? ''), 0, 10);
                if ($orderDate === '') {
                    return false;
                }
                if ($from && $orderDate < $from) {
                    return false;
                }
                if ($to && $orderDate > $to) {
                    return false;
                }

                return true;
            })->values();
        }

        // Newest first (order date/time, then last updated).
        $collection = $collection
            ->sortByDesc(fn ($o) => (string) ($o['order_date'] ?? '').'|'.(string) ($o['last_updated'] ?? ''))
            ->values();

        return [
            'data' => $collection->all(),
            'meta' => ['count' => $collection->count(), 'using_mock' => $this->useMock()],
        ];
    }

    /**
     * @param  array<string, mixed>  $order
     */
    private function isInvoicedListingOrder(array $order): bool
    {
        $phase = (string) ($order['current_phase'] ?? '');

        return $phase === 'invoiced'
            || $phase === 'completed'
            || (($order['spire']['source'] ?? null) === 'invoice')
            || trim((string) ($order['invoice_date'] ?? '')) !== ''
            || trim((string) ($order['spire']['invoice_no'] ?? '')) !== '';
    }

    private function useMock(): bool
    {
        return (bool) Setting::getValue('use_mock_orders', true);
    }

    /**
     * Mock orders matching the screenshot layout.
     */
    public function mockOrders(): array
    {
        return [
            [
                'id' => 'ORD-100123',
                'order_number' => 'ORD-100123',
                'customer' => 'Acme Corp',
                'order_date' => '2025-05-14 09:12',
                'current_phase' => 'shipping_preparation',
                'current_phase_index' => 4,
                'phase_states' => ['completed', 'completed', 'completed', 'current', 'pending', 'pending'],
                'skipped_phases' => [],
                'elapsed_time' => '18 min',
                'conditions' => [],
                'last_updated' => '2025-05-14 09:30',
                'is_completed' => false,
                'is_delayed' => false,
                'completed_today' => false,
                'items' => [
                    ['item' => 'Widget A', 'sku' => 'WGT-A-001', 'ordered' => 10, 'ship_qty' => 10, 'bo_qty' => 0, 'status' => 'done'],
                    ['item' => 'Widget B', 'sku' => 'WGT-B-002', 'ordered' => 5, 'ship_qty' => 5, 'bo_qty' => 0, 'status' => 'done'],
                    ['item' => 'Bracket C', 'sku' => 'BRK-C-003', 'ordered' => 2, 'ship_qty' => 2, 'bo_qty' => 0, 'status' => 'done'],
                ],
                'shipping' => [
                    'carrier' => 'FedEx',
                    'service' => 'FedEx Ground',
                    'tracking' => '7946 1234 5678',
                    'weight' => '18.4 lb',
                    'est_delivery' => 'May 16, 2025',
                ],
                'timeline' => [
                    ['phase' => 'Received', 'at' => '2025-05-14 09:12'],
                    ['phase' => 'Ready to Pick', 'at' => '2025-05-14 09:18'],
                    ['phase' => 'Picked & Packed', 'at' => '2025-05-14 09:25'],
                    ['phase' => 'Shipping Preparation', 'at' => '2025-05-14 09:30'],
                ],
                'additional' => [
                    'sales_order' => 'SO-88912',
                    'customer_po' => 'PO-44102',
                    'created_by' => 'Jane Doe',
                    'warehouse' => 'Main Warehouse',
                    'notes' => 'Handle with care – fragile items.',
                ],
            ],
            [
                'id' => 'ORD-100124',
                'order_number' => 'ORD-100124',
                'customer' => 'Bright Foods Ltd',
                'order_date' => '2025-05-14 08:40',
                'current_phase' => 'picked_packed',
                'current_phase_index' => 3,
                'phase_states' => ['completed', 'completed', 'current', 'pending', 'pending', 'pending'],
                'skipped_phases' => [],
                'elapsed_time' => '45 min',
                'conditions' => ['On Hold'],
                'last_updated' => '2025-05-14 09:20',
                'is_completed' => false,
                'is_delayed' => false,
                'completed_today' => false,
                'items' => [
                    ['item' => 'Case Pack', 'sku' => 'CP-100', 'ordered' => 20, 'ship_qty' => 18, 'bo_qty' => 2, 'status' => 'backordered'],
                ],
                'shipping' => null,
                'timeline' => [
                    ['phase' => 'Received', 'at' => '2025-05-14 08:40'],
                    ['phase' => 'Ready to Pick', 'at' => '2025-05-14 08:55'],
                    ['phase' => 'Picked & Packed', 'at' => '2025-05-14 09:20'],
                ],
                'additional' => [
                    'sales_order' => 'SO-88913',
                    'customer_po' => 'PO-55110',
                    'created_by' => 'John Smith',
                    'warehouse' => 'Main Warehouse',
                    'notes' => 'Waiting on stock confirmation.',
                ],
            ],
            [
                'id' => 'ORD-100125',
                'order_number' => 'ORD-100125',
                'customer' => 'Nova Retail',
                'order_date' => '2025-05-14 07:15',
                'current_phase' => 'ready_to_pick',
                'current_phase_index' => 2,
                'phase_states' => ['completed', 'current', 'skipped', 'skipped', 'pending', 'pending'],
                'skipped_phases' => ['picked_packed', 'shipping_preparation'],
                'elapsed_time' => '2h 10m',
                'conditions' => ['Customer Pickup'],
                'last_updated' => '2025-05-14 08:00',
                'is_completed' => false,
                'is_delayed' => false,
                'completed_today' => false,
                'items' => [
                    ['item' => 'Display Kit', 'sku' => 'DSP-01', 'ordered' => 1, 'ship_qty' => 0, 'bo_qty' => 1, 'status' => 'backordered'],
                ],
                'shipping' => null,
                'timeline' => [
                    ['phase' => 'Received', 'at' => '2025-05-14 07:15'],
                    ['phase' => 'Ready to Pick', 'at' => '2025-05-14 08:00'],
                ],
                'additional' => [
                    'sales_order' => 'SO-88920',
                    'customer_po' => 'PO-22001',
                    'created_by' => 'Sam Lee',
                    'warehouse' => 'Store Pickup Desk',
                    'notes' => 'Customer pickup – skip packing & shipping prep.',
                ],
            ],
            [
                'id' => 'ORD-100126',
                'order_number' => 'ORD-100126',
                'customer' => 'Delta Hardware',
                'order_date' => '2025-05-13 16:20',
                'current_phase' => 'shipping_preparation',
                'current_phase_index' => 4,
                'phase_states' => ['completed', 'completed', 'completed', 'current', 'pending', 'pending'],
                'skipped_phases' => [],
                'elapsed_time' => '1d 2h',
                'conditions' => [],
                'last_updated' => '2025-05-14 09:05',
                'is_completed' => false,
                'is_delayed' => true,
                'completed_today' => false,
                'items' => [
                    ['item' => 'Bolt Set', 'sku' => 'BLT-44', 'ordered' => 50, 'ship_qty' => 50, 'bo_qty' => 0, 'status' => 'done'],
                ],
                'shipping' => [
                    'carrier' => 'UPS',
                    'service' => 'UPS Ground',
                    'tracking' => '1Z999AA10123456784',
                    'weight' => '42.0 lb',
                    'est_delivery' => 'May 17, 2025',
                ],
                'timeline' => [
                    ['phase' => 'Received', 'at' => '2025-05-13 16:20'],
                    ['phase' => 'Ready to Pick', 'at' => '2025-05-13 17:00'],
                    ['phase' => 'Picked & Packed', 'at' => '2025-05-13 18:30'],
                    ['phase' => 'Shipping Preparation', 'at' => '2025-05-14 09:05'],
                ],
                'additional' => [
                    'sales_order' => 'SO-88801',
                    'customer_po' => 'PO-99012',
                    'created_by' => 'Alex Kim',
                    'warehouse' => 'Main Warehouse',
                    'notes' => '',
                ],
            ],
            [
                'id' => 'ORD-100127',
                'order_number' => 'ORD-100127',
                'customer' => 'Orbit Electronics',
                'order_date' => '2025-05-14 06:50',
                'current_phase' => 'invoiced',
                'current_phase_index' => 5,
                'phase_states' => ['completed', 'completed', 'completed', 'completed', 'completed', 'completed'],
                'skipped_phases' => [],
                'elapsed_time' => '3h 05m',
                'conditions' => ['Backordered'],
                'last_updated' => '2025-05-14 09:40',
                'is_completed' => true,
                'is_delayed' => false,
                'completed_today' => true,
                'items' => [
                    ['item' => 'Sensor Pack', 'sku' => 'SNS-9', 'ordered' => 8, 'ship_qty' => 8, 'bo_qty' => 0, 'status' => 'done'],
                ],
                'shipping' => [
                    'carrier' => 'DHL',
                    'service' => 'Express',
                    'tracking' => 'JD0146000123456789',
                    'weight' => '6.2 lb',
                    'est_delivery' => 'May 15, 2025',
                ],
                'timeline' => [
                    ['phase' => 'Received', 'at' => '2025-05-14 06:50'],
                    ['phase' => 'Ready to Pick', 'at' => '2025-05-14 07:10'],
                    ['phase' => 'Picked & Packed', 'at' => '2025-05-14 08:00'],
                    ['phase' => 'Shipping Preparation', 'at' => '2025-05-14 08:45'],
                    ['phase' => 'Invoiced', 'at' => '2025-05-14 09:40'],
                    ['phase' => 'Completed', 'at' => '2025-05-14 09:40'],
                ],
                'additional' => [
                    'sales_order' => 'SO-88940',
                    'customer_po' => 'PO-33044',
                    'created_by' => 'Priya Nair',
                    'warehouse' => 'Main Warehouse',
                    'notes' => 'Partial backorder on accessory kit.',
                ],
            ],
            [
                'id' => 'ORD-100128',
                'order_number' => 'ORD-100128',
                'customer' => 'Summit Traders',
                'order_date' => '2025-05-14 05:30',
                'current_phase' => 'invoiced',
                'current_phase_index' => 5,
                'phase_states' => ['completed', 'completed', 'completed', 'completed', 'completed', 'completed'],
                'skipped_phases' => [],
                'elapsed_time' => '4h 20m',
                'conditions' => [],
                'last_updated' => '2025-05-14 09:50',
                'is_completed' => true,
                'is_delayed' => false,
                'completed_today' => true,
                'items' => [
                    ['item' => 'Starter Kit', 'sku' => 'STK-1', 'ordered' => 3, 'ship_qty' => 3, 'bo_qty' => 0, 'status' => 'done'],
                ],
                'shipping' => [
                    'carrier' => 'FedEx',
                    'service' => 'Priority Overnight',
                    'tracking' => '7946 9876 5432',
                    'weight' => '4.1 lb',
                    'est_delivery' => 'May 14, 2025',
                ],
                'timeline' => [
                    ['phase' => 'Received', 'at' => '2025-05-14 05:30'],
                    ['phase' => 'Completed', 'at' => '2025-05-14 09:50'],
                ],
                'additional' => [
                    'sales_order' => 'SO-88900',
                    'customer_po' => 'PO-11002',
                    'created_by' => 'John Smith',
                    'warehouse' => 'Main Warehouse',
                    'notes' => 'Delivered and closed.',
                ],
            ],
        ];
    }
}
