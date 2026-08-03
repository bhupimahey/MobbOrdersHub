<?php

use App\Models\Setting;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        $settings = [
            [
                'key' => 'spire_base_url',
                'value' => 'https://square-sales-8907.spirelan.com:10880',
                'type' => 'string',
                'group' => 'spire',
                'label' => 'Spire Base URL',
                'is_encrypted' => false,
            ],
            [
                'key' => 'spire_company',
                'value' => 'MOB_MED2',
                'type' => 'string',
                'group' => 'spire',
                'label' => 'Spire Company / Database',
                'is_encrypted' => false,
            ],
            [
                'key' => 'spire_username',
                'value' => 'Swiftcount',
                'type' => 'string',
                'group' => 'spire',
                'label' => 'Spire Username',
                'is_encrypted' => false,
            ],
            [
                'key' => 'spire_password',
                'value' => '',
                'type' => 'string',
                'group' => 'spire',
                'label' => 'Spire Password',
                'is_encrypted' => false,
            ],
            [
                'key' => 'spire_verify_ssl',
                'value' => '0',
                'type' => 'boolean',
                'group' => 'spire',
                'label' => 'Verify Spire SSL Certificate',
                'is_encrypted' => false,
            ],
        ];

        foreach ($settings as $setting) {
            Setting::query()->updateOrCreate(
                ['key' => $setting['key']],
                $setting
            );
        }

        // Move mock toggle into Spire group if it exists
        Setting::query()->where('key', 'use_mock_orders')->update([
            'group' => 'spire',
            'label' => 'Use Mock Order Data (disable for live Spire)',
        ]);

        Setting::query()->whereIn('key', [
            'erp_api_base_url',
            'erp_api_key',
            'erp_orders_list_path',
            'erp_order_details_path',
            'erp_order_status_path',
            'erp_order_update_path',
        ])->delete();
    }

    public function down(): void
    {
        Setting::query()->whereIn('key', [
            'spire_base_url',
            'spire_company',
            'spire_username',
            'spire_password',
            'spire_verify_ssl',
        ])->delete();
    }
};
