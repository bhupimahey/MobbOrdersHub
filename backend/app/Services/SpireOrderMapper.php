<?php

namespace App\Services;

class SpireOrderMapper
{
    private const PHASES = [
        'received',
        'ready_to_pick',
        'picked_packed',
        'shipping_preparation',
        'invoiced',
        'shipped',
        'completed',
    ];

    public function mapList(array $records): array
    {
        return array_map(fn (array $row) => $this->mapOrder($row), $records);
    }

    public function mapOrder(array $raw, array $items = []): array
    {
        $phase = $this->resolvePhase($raw);
        $phaseIndex = array_search($phase, self::PHASES, true);
        if ($phaseIndex === false) {
            $phaseIndex = 0;
            $phase = 'received';
        }

        $orderNo = (string) ($raw['orderNo'] ?? $raw['id'] ?? '');
        $id = (string) ($raw['id'] ?? $orderNo);
        // Prefer orderDate for the day; attach time from created when Spire sends date-only orderDate.
        $created = $this->formatOrderDateTime($raw['orderDate'] ?? null, $raw['created'] ?? null);
        $modified = $this->formatDateTime($raw['modified'] ?? $raw['created'] ?? null);
        $customer = (string) data_get($raw, 'customer.name', data_get($raw, 'shippingAddress.name', '—'));

        $conditions = [];
        if (! empty($raw['hold'])) {
            $conditions[] = 'On Hold';
        }
        if (! empty($raw['backordered'])) {
            $conditions[] = 'Backordered';
        }

        $shipCode = (string) data_get($raw, 'shippingAddress.shipCode', '');
        if (stripos($shipCode, 'pickup') !== false || stripos((string) data_get($raw, 'shippingAddress.shipDescription', ''), 'pickup') !== false) {
            $conditions[] = 'Customer Pickup';
        }

        $mappedItems = $this->mapItems($items !== [] ? $items : ($raw['items'] ?? []));

        $tracking = trim((string) ($raw['trackingNo'] ?? ''));
        $carrier = trim((string) ($raw['shippingCarrier'] ?? ''));
        $weight = trim((string) ($raw['weight'] ?? ''));
        $shipDate = $this->formatDateTime($raw['shipDate'] ?? $raw['requiredDate'] ?? null);

        $shipping = null;
        if ($carrier !== '' || $tracking !== '' || $weight !== '') {
            $shipping = [
                'carrier' => $carrier !== '' ? $carrier : '—',
                'service' => (string) data_get($raw, 'shippingAddress.shipDescription', $shipCode !== '' ? $shipCode : '—'),
                'tracking' => $tracking !== '' ? $tracking : '—',
                'weight' => $weight !== '' ? $weight : '—',
                'est_delivery' => $shipDate ?: '—',
            ];
        }

        return [
            'id' => $id,
            'order_number' => $orderNo !== '' ? $orderNo : $id,
            'customer' => $customer,
            'order_date' => $created,
            'current_phase' => $phase,
            'current_phase_index' => $phaseIndex + 1,
            'phase_states' => $this->phaseStates($phaseIndex),
            'skipped_phases' => [],
            'elapsed_time' => $this->elapsed($raw['created'] ?? $raw['orderDate'] ?? null),
            'conditions' => $conditions,
            'last_updated' => $modified,
            'is_completed' => $phase === 'completed',
            'is_delayed' => false,
            'completed_today' => $phase === 'completed' && str_starts_with($modified, date('Y-m-d')),
            'items' => $mappedItems,
            'shipping' => $shipping,
            'timeline' => $this->timeline($raw, $phase),
            'additional' => [
                'sales_order' => $orderNo,
                'customer_po' => (string) ($raw['customerPO'] ?? '—'),
                'created_by' => (string) ($raw['createdBy'] ?? '—'),
                'warehouse' => (string) ($raw['location'] ?? '—'),
                'notes' => (string) ($raw['referenceNo'] ?? ''),
            ],
            'spire' => [
                'status' => $raw['status'] ?? null,
                'phase_id' => $raw['phaseId'] ?? null,
                'invoice_no' => $raw['invoiceNo'] ?? null,
                'batch_no' => $raw['batchNo'] ?? null,
            ],
        ];
    }

    private function mapItems(mixed $items): array
    {
        if (! is_array($items)) {
            return [];
        }

        if (isset($items['records']) && is_array($items['records'])) {
            $items = $items['records'];
        }

        $out = [];
        foreach ($items as $item) {
            if (! is_array($item)) {
                continue;
            }
            $ordered = (float) ($item['orderQty'] ?? $item['qtyOrdered'] ?? $item['quantity'] ?? 0);
            $picked = (float) ($item['qtyShipped'] ?? $item['shipQty'] ?? $item['picked'] ?? 0);
            $packed = (float) ($item['qtyPacked'] ?? $item['packed'] ?? $picked);
            $out[] = [
                'item' => (string) ($item['description'] ?? $item['partNo'] ?? data_get($item, 'inventory.description', 'Item')),
                'sku' => (string) ($item['partNo'] ?? data_get($item, 'inventory.partNo', '—')),
                'ordered' => $ordered,
                'picked' => $picked,
                'packed' => $packed,
                'status' => ($ordered > 0 && $picked >= $ordered) ? 'done' : 'in_progress',
            ];
        }

        return $out;
    }

    private function resolvePhase(array $raw): string
    {
        // Spire custom workflow uses phaseId labels like "PICKED & PACKED"
        $fromPhaseId = $this->mapSpirePhaseId((string) ($raw['phaseId'] ?? ''));
        if ($fromPhaseId !== null) {
            return $fromPhaseId;
        }

        $status = strtolower(trim((string) ($raw['status'] ?? '')));
        $invoiceNo = trim((string) ($raw['invoiceNo'] ?? ''));
        $shipDate = trim((string) ($raw['shipDate'] ?? ''));
        $tracking = trim((string) ($raw['trackingNo'] ?? ''));

        if (str_contains($status, 'complete') || str_contains($status, 'closed') || $status === 'c') {
            return 'completed';
        }
        // Only treat as shipped when Spire has an actual ship date (tracking alone is not enough —
        // clients often enter a test tracking # before the shipped phase).
        if ($shipDate !== '' || (str_contains($status, 'ship') && ! str_contains($status, 'prep'))) {
            return 'shipped';
        }
        if ($invoiceNo !== '' || str_contains($status, 'invoice') || $status === 'i') {
            return 'invoiced';
        }
        if (str_contains($status, 'pack') || str_contains($status, 'pick')) {
            return str_contains($status, 'pack') ? 'picked_packed' : 'ready_to_pick';
        }
        if (str_contains($status, 'ship') && str_contains($status, 'prep')) {
            return 'shipping_preparation';
        }

        // Open order with tracking pre-filled still stays in received unless phaseId says otherwise
        if ($tracking !== '' && $status === 'o') {
            return 'received';
        }

        return 'received';
    }

    private function mapSpirePhaseId(string $phaseId): ?string
    {
        $raw = trim($phaseId);
        if ($raw === '') {
            return null;
        }

        $normalized = strtolower($raw);
        $normalized = str_replace(['&', '/', '-', '_'], ' ', $normalized);
        $normalized = (string) preg_replace('/\s+/', ' ', $normalized);

        if (in_array($normalized, self::PHASES, true)) {
            return $normalized;
        }

        if (is_numeric($normalized)) {
            $idx = ((int) $normalized) - 1;

            return self::PHASES[$idx] ?? null;
        }

        // Longer phrases first so "shipping preparation" does not match bare "ship".
        $aliases = [
            'shipping preparation' => 'shipping_preparation',
            'shipping prep' => 'shipping_preparation',
            'ship preparation' => 'shipping_preparation',
            'picked and packed' => 'picked_packed',
            'picked packed' => 'picked_packed',
            'pick packed' => 'picked_packed',
            'ready to pick' => 'ready_to_pick',
            'ready for pick' => 'ready_to_pick',
            'order received' => 'received',
            'received' => 'received',
            'invoiced' => 'invoiced',
            'invoice' => 'invoiced',
            'shipped' => 'shipped',
            'completed' => 'completed',
            'complete' => 'completed',
            'closed' => 'completed',
        ];

        if (isset($aliases[$normalized])) {
            return $aliases[$normalized];
        }

        foreach ($aliases as $needle => $code) {
            if (str_contains($normalized, $needle)) {
                return $code;
            }
        }

        return null;
    }

    private function phaseStates(int $currentIndex): array
    {
        $states = [];
        foreach (self::PHASES as $i => $_) {
            if ($i < $currentIndex) {
                $states[] = 'completed';
            } elseif ($i === $currentIndex) {
                $states[] = 'current';
            } else {
                $states[] = 'pending';
            }
        }

        return $states;
    }

    private function timeline(array $raw, string $phase): array
    {
        $created = $this->formatDate($raw['created'] ?? $raw['orderDate'] ?? null);
        $items = [
            ['phase' => 'Received', 'at' => $created],
        ];

        $labels = [
            'ready_to_pick' => 'Ready to Pick',
            'picked_packed' => 'Picked & Packed',
            'shipping_preparation' => 'Shipping Preparation',
            'invoiced' => 'Invoiced',
            'shipped' => 'Shipped',
            'completed' => 'Completed',
        ];

        $idx = array_search($phase, self::PHASES, true) ?: 0;
        for ($i = 1; $i <= $idx; $i++) {
            $code = self::PHASES[$i];
            $at = $this->formatDate($raw['modified'] ?? $raw['invoiceDate'] ?? $raw['shipDate'] ?? $created);
            $items[] = ['phase' => $labels[$code] ?? $code, 'at' => $at];
        }

        return $items;
    }

    private function elapsed(?string $from): string
    {
        if (! $from) {
            return '—';
        }
        try {
            $start = new \DateTimeImmutable($from);
            $diff = (new \DateTimeImmutable)->getTimestamp() - $start->getTimestamp();
            if ($diff < 0) {
                $diff = 0;
            }
            $hours = intdiv($diff, 3600);
            $mins = intdiv($diff % 3600, 60);
            if ($hours > 0) {
                return $hours.'h '.str_pad((string) $mins, 2, '0', STR_PAD_LEFT).'m';
            }

            return $mins.' min';
        } catch (\Throwable) {
            return '—';
        }
    }

    private function formatDate(mixed $value): string
    {
        return $this->formatDateTime($value);
    }

    /**
     * Spire orderDate is often date-only (YYYY-MM-DD). Prefer created timestamp for clock time.
     */
    private function formatOrderDateTime(mixed $orderDate, mixed $created): string
    {
        $orderDate = $orderDate !== null && $orderDate !== '' ? (string) $orderDate : '';
        $created = $created !== null && $created !== '' ? (string) $created : '';

        if ($orderDate !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $orderDate) && $created !== '') {
            try {
                $createdDt = new \DateTimeImmutable($created);

                return $orderDate.' '.$createdDt->format('H:i');
            } catch (\Throwable) {
                return $orderDate;
            }
        }

        if ($orderDate !== '') {
            return $this->formatDateTime($orderDate);
        }

        return $this->formatDateTime($created);
    }

    private function formatDateTime(mixed $value): string
    {
        if (! $value) {
            return '';
        }
        try {
            // Spire timestamps are usually office-local without timezone suffix.
            return (new \DateTimeImmutable((string) $value))->format('Y-m-d H:i');
        } catch (\Throwable) {
            return (string) $value;
        }
    }

}
