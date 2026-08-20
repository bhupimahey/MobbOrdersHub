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
        // Spire UTC → America/Toronto (EDT, UTC-4 in July/August).
        $this->assertSame('2026-07-10 08:10:31', $mapped['order_date']);
        $this->assertSame('2026-08-05 12:01:35', $mapped['last_updated']);
        $this->assertSame('2026-07-10 00:00:00', $mapped['shipping']['est_delivery']);
        $this->assertCount(1, $mapped['items']);
        $this->assertSame('T9012-BL-XS', $mapped['items'][0]['sku']);
        $this->assertSame(1.0, $mapped['items'][0]['ship_qty']);
        $this->assertSame(0.0, $mapped['items'][0]['bo_qty']);
        $this->assertSame('done', $mapped['items'][0]['status']);
    }

    public function test_converts_spire_utc_timestamps_to_toronto(): void
    {
        $mapper = new SpireOrderMapper;
        $mapped = $mapper->mapOrder([
            'id' => 1,
            'orderNo' => '00167861-0',
            'status' => 'O',
            'orderDate' => '2026-08-04',
            'created' => '2026-08-04T16:06:49.541768',
            'modified' => '2026-08-04T16:06:49.541768',
            'createdBy' => 'DZ',
            'customer' => ['name' => 'Test'],
        ]);

        // 16:06:49 UTC → 12:06:49 America/Toronto (EDT).
        $this->assertSame('2026-08-04 12:06:49', $mapped['order_date']);
        $this->assertSame('2026-08-04 12:06:49', $mapped['last_updated']);
        $this->assertSame('2026-08-04 12:06:49', $mapped['timeline'][0]['at']);
    }

    public function test_maps_financial_fields(): void
    {
        $mapper = new SpireOrderMapper;
        $mapped = $mapper->mapOrder([
            'id' => 271519,
            'orderNo' => '00167864-0',
            'status' => 'O',
            'orderDate' => '2026-08-04',
            'created' => '2026-08-04T19:03:19.906029',
            'freight' => '0',
            'discount' => '3',
            'totalDiscount' => '57.83',
            'surcharge' => '0',
            'subtotal' => '1927.7',
            'total' => '2112.95',
            'totalOrdered' => '2112.95',
            'subtotalOrdered' => '1927.7',
            'grossProfit' => '1869.87',
            'grossProfitMargin' => '100',
            'weight' => '0',
            'termsCode' => 'NET60',
            'termsText' => 'Net 60 Days',
            'backordered' => false,
            'totalBackorderQty' => '0',
            'requiredDate' => '2026-08-04',
            'customer' => ['name' => 'Canadian Linen'],
            'shippingAddress' => [
                'shipCode' => 'UPS',
                'shipDescription' => 'UPS',
            ],
        ]);

        $this->assertSame('0', $mapped['financial']['freight']);
        $this->assertSame('3', $mapped['financial']['discount']);
        $this->assertSame('57.83', $mapped['financial']['total_discount']);
        $this->assertSame('1927.7', $mapped['financial']['subtotal']);
        $this->assertSame('2112.95', $mapped['financial']['total']);
        $this->assertSame('Net 60 Days', $mapped['financial']['terms_text']);
        $this->assertSame('UPS', $mapped['shipping']['service']);
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

    public function test_freight_moves_to_shipping_preparation(): void
    {
        $mapper = new SpireOrderMapper;
        $mapped = $mapper->mapOrder([
            'id' => 10,
            'orderNo' => 'F-1',
            'status' => 'O',
            'phaseId' => 'PICKED & PACKED',
            'freight' => '25.50',
            'orderDate' => '2026-07-10',
            'created' => '2026-07-10T12:10:31',
            'customer' => ['name' => 'Test'],
        ]);

        $this->assertSame('shipping_preparation', $mapped['current_phase']);
        $this->assertFalse($mapped['is_completed']);
    }

    public function test_invoice_marks_invoiced_and_completed(): void
    {
        $mapper = new SpireOrderMapper;
        $mapped = $mapper->mapOrder([
            'id' => 11,
            'orderNo' => 'I-1',
            'status' => 'O',
            'phaseId' => 'INVOICED',
            'invoiceNo' => 'INV-100',
            'orderDate' => '2026-07-10',
            'created' => '2026-07-10T12:10:31',
            'modified' => date('Y-m-d').'T10:00:00',
            'customer' => ['name' => 'Test'],
        ]);

        $this->assertSame('invoiced', $mapped['current_phase']);
        $this->assertTrue($mapped['is_completed']);
        $this->assertSame(
            ['completed', 'completed', 'completed', 'completed', 'completed', 'completed'],
            $mapped['phase_states']
        );
        $phases = array_column($mapped['timeline'], 'phase');
        $this->assertContains('Invoiced', $phases);
        $this->assertContains('Completed', $phases);
    }

    public function test_map_invoice_from_sales_history(): void
    {
        $mapper = new SpireOrderMapper;
        $mapped = $mapper->mapInvoice([
            'id' => 9001,
            'invoiceNo' => '00009999',
            'orderNo' => 'E0007736-0',
            'invoiceDate' => date('Y-m-d').'T15:30:00',
            'orderDate' => '2026-07-10',
            'customer' => ['name' => 'TEST COMPANY (SAN)'],
            'freight' => '12.5',
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

        $this->assertSame('invoiced', $mapped['current_phase']);
        $this->assertTrue($mapped['is_completed']);
        $this->assertTrue($mapped['completed_today']);
        $this->assertSame('invoice', $mapped['spire']['source']);
        $this->assertSame('00009999', $mapped['spire']['invoice_no']);
        $this->assertSame('E0007736-0', $mapped['order_number']);
        $this->assertContains('Completed', array_column($mapped['timeline'], 'phase'));
    }

    public function test_ship_date_maps_to_shipping_preparation_not_shipped(): void
    {
        $mapper = new SpireOrderMapper;
        $mapped = $mapper->mapOrder([
            'id' => 12,
            'orderNo' => 'S-1',
            'status' => 'O',
            'shipDate' => '2026-07-11',
            'orderDate' => '2026-07-10',
            'created' => '2026-07-10T12:10:31',
            'customer' => ['name' => 'Test'],
        ]);

        $this->assertSame('shipping_preparation', $mapped['current_phase']);
        $this->assertCount(6, $mapped['phase_states']);
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
