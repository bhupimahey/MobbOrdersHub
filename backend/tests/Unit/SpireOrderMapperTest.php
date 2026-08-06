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
                    'backorderQty' => '0',
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
        $this->assertSame(1.0, $mapped['items'][0]['ship_qty']);
        $this->assertSame(0.0, $mapped['items'][0]['bo_qty']);
        $this->assertSame('done', $mapped['items'][0]['status']);
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

    public function test_skips_blank_and_comment_item_rows(): void
    {
        $mapper = new SpireOrderMapper;
        $mapped = $mapper->mapOrder([
            'id' => 2,
            'orderNo' => 'E0007013-2',
            'status' => 'O',
            'orderDate' => '2026-03-02',
            'created' => '2026-03-02T18:34:00',
            'customer' => ['name' => 'Test'],
            'items' => [
                [
                    'partNo' => 'ELINOR-BLK-M',
                    'description' => 'Tall The Elinor Black M',
                    'orderQty' => '2',
                    'committedQty' => '0',
                ],
                [
                    'partNo' => '',
                    'description' => '',
                    'orderQty' => '0',
                ],
                [
                    'partNo' => null,
                    'description' => 'BACK ORDER',
                    'orderQty' => '0',
                ],
                [
                    'partNo' => 'SKIP-ME',
                    'description' => 'Suppressed line',
                    'orderQty' => '1',
                    'suppress' => true,
                ],
            ],
        ]);

        $this->assertCount(1, $mapped['items']);
        $this->assertSame('Tall The Elinor Black M', $mapped['items'][0]['item']);
        $this->assertSame('ELINOR-BLK-M', $mapped['items'][0]['sku']);
    }

    public function test_maps_ship_and_backorder_quantities(): void
    {
        $mapper = new SpireOrderMapper;
        $mapped = $mapper->mapOrder([
            'id' => 3,
            'orderNo' => 'E-BO',
            'status' => 'O',
            'orderDate' => '2026-08-01',
            'created' => '2026-08-01T10:00:00',
            'customer' => ['name' => 'Test'],
            'items' => [
                [
                    'partNo' => 'X310/307-PS-L',
                    'description' => 'Scrub Set Postman Blue L',
                    'orderQty' => '4',
                    'committedQty' => '4',
                    'backorderQty' => '0',
                ],
                [
                    'partNo' => 'X310/307-PS-XL',
                    'description' => 'Scrub Set Postman Blue XL',
                    'orderQty' => '2',
                    'committedQty' => '1',
                    'backorderQty' => '1',
                ],
            ],
        ]);

        $this->assertCount(2, $mapped['items']);
        $this->assertSame('done', $mapped['items'][0]['status']);
        $this->assertSame(4.0, $mapped['items'][0]['ship_qty']);
        $this->assertSame('backordered', $mapped['items'][1]['status']);
        $this->assertSame(1.0, $mapped['items'][1]['bo_qty']);
    }
}
