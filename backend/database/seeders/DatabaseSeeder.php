<?php

namespace Database\Seeders;

use App\Models\OrderPhase;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $phases = [
            ['code' => 'received', 'name' => 'Received', 'description' => 'Order received in the system', 'sort_order' => 1, 'color' => 'blue', 'icon' => 'clipboard-list'],
            ['code' => 'ready_to_pick', 'name' => 'Ready to Pick', 'description' => 'Order is verified and ready for picking', 'sort_order' => 2, 'color' => 'green', 'icon' => 'shopping-cart'],
            ['code' => 'picked_packed', 'name' => 'Picked & Packed', 'description' => 'Items picked and packed', 'sort_order' => 3, 'color' => 'green', 'icon' => 'package'],
            ['code' => 'shipping_preparation', 'name' => 'Shipping Preparation', 'description' => 'Order is weighed and prepared for shipping (label & carrier)', 'sort_order' => 4, 'color' => 'purple', 'icon' => 'scale'],
            ['code' => 'invoiced', 'name' => 'Invoiced', 'description' => 'Invoice has been created for the order', 'sort_order' => 5, 'color' => 'orange', 'icon' => 'file-text'],
            ['code' => 'shipped', 'name' => 'Shipped', 'description' => 'Order picked up by carrier / shipped to customer', 'sort_order' => 6, 'color' => 'blue', 'icon' => 'truck'],
            ['code' => 'completed', 'name' => 'Completed', 'description' => 'Order is successfully delivered and closed', 'sort_order' => 7, 'color' => 'green', 'icon' => 'check-circle'],
        ];

        foreach ($phases as $phase) {
            OrderPhase::query()->updateOrCreate(
                ['code' => $phase['code']],
                array_merge($phase, ['is_active' => true])
            );
        }

        // Create Super Admin once — never overwrite an existing password on re-seed
        $admin = User::query()->firstOrCreate(
            ['email' => 'sanmehmi@gmail.com'],
            [
                'name' => 'Super Admin',
                'password' => Hash::make('sanmehmi'),
                'role' => User::ROLE_SUPER_ADMIN,
                'job_title' => 'Super Admin',
                'avatar_initials' => 'SA',
                'is_active' => true,
            ]
        );

        if (! $admin->wasRecentlyCreated) {
            $admin->forceFill([
                'role' => User::ROLE_SUPER_ADMIN,
                'is_active' => true,
            ])->save();
        }

        $settings = [
            // Spire ERP (live)
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
                'value' => '',
                'type' => 'string',
                'group' => 'spire',
                'label' => 'Spire Username',
                'is_encrypted' => true,
            ],
            [
                'key' => 'spire_password',
                'value' => '',
                'type' => 'string',
                'group' => 'spire',
                'label' => 'Spire Password',
                'is_encrypted' => true,
            ],
            [
                'key' => 'spire_verify_ssl',
                'value' => '0',
                'type' => 'boolean',
                'group' => 'spire',
                'label' => 'Verify Spire SSL Certificate',
                'is_encrypted' => false,
            ],
            [
                'key' => 'use_mock_orders',
                'value' => '1',
                'type' => 'boolean',
                'group' => 'spire',
                'label' => 'Use Mock Order Data (disable for live Spire)',
                'is_encrypted' => false,
            ],
            [
                'key' => 'app_name',
                'value' => 'MOBB Orders Admin',
                'type' => 'string',
                'group' => 'general',
                'label' => 'Application Name',
                'is_encrypted' => false,
            ],
        ];

        // Insert missing settings only — never overwrite live values (e.g. Spire credentials)
        foreach ($settings as $setting) {
            Setting::query()->firstOrCreate(
                ['key' => $setting['key']],
                $setting
            );
        }

        // Remove legacy generic ERP path settings if present
        Setting::query()->whereIn('key', [
            'erp_api_base_url',
            'erp_api_key',
            'erp_orders_list_path',
            'erp_order_details_path',
            'erp_order_status_path',
            'erp_order_update_path',
        ])->delete();
    }
}
