<?php

namespace Tests\Unit;

use App\Services\SpireOrderMapper;
use PHPUnit\Framework\TestCase;

class SpireOrderMapperTest extends TestCase
{
    public function test_maps_picked_and_packed_phase_id(): void
    {
        $mapper = new SpireOrderMapper;
        $mapped = $mapper->mapOrder([
            'id' => 271025,
            'orderNo' => 'E0007736-0',
            'status' => 'O',
            'phaseId' => 'PICKED & PACKED',
            'orderDate' => '2026-07-10',
            'created' => '2026-07-10T12:10:31.569803',
            'modified' => '2026-08-05T16:01:35.255937',
            'trackingNo' => 'santest135',
            'shipDate' => null,
            'requiredDate' => '2026-07-10',
            'invoiceNo' => null,
            'customer' => ['name' => 'TEST COMPANY (SAN)'],
            'items' => [
                [
                    'partNo' => 'T9012-BL-XS',
                    'description' => 'The Katrina Black XS',
                    'orderQty' => '1',
                    'committedQty' => '1',
                ],
            ],
        ]);

        $this->assertSame('picked_packed', $mapped['current_phase']);
        $this->assertSame(3, $mapped['current_phase_index']);
        $this->assertSame('2026-07-10 12:10', $mapped['order_date']);
        $this->assertSame('2026-08-05 16:01', $mapped['last_updated']);
        $this->assertSame('2026-07-10 00:00', $mapped['shipping']['est_delivery']);
        $this->assertCount(1, $mapped['items']);
        $this->assertSame('T9012-BL-XS', $mapped['items'][0]['sku']);
    }

    public function test_tracking_alone_does_not_mean_shipped(): void
    {
        $mapper = new SpireOrderMapper;
        $mapped = $mapper->mapOrder([
            'id' => 1,
            'orderNo' => 'X-1',
            'status' => 'O',
            'trackingNo' => 'ABC123',
            'shipDate' => null,
            'orderDate' => '2026-07-10',
            'created' => '2026-07-10T12:10:31',
            'customer' => ['name' => 'Test'],
        ]);

        $this->assertSame('received', $mapped['current_phase']);
    }
}
