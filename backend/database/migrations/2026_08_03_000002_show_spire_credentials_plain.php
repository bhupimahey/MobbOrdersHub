<?php

use App\Models\Setting;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        foreach (['spire_username' => 'Swiftcount', 'spire_password' => ''] as $key => $fallback) {
            $current = Setting::getValue($key, $fallback);

            Setting::setValue($key, $current ?? $fallback, [
                'type' => 'string',
                'group' => 'spire',
                'label' => $key === 'spire_username' ? 'Spire Username' : 'Spire Password',
                'is_encrypted' => false,
            ]);
        }

        Setting::flushCache();
    }

    public function down(): void
    {
        // Intentionally left blank — credentials stay readable.
    }
};
