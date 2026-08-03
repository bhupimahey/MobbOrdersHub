<?php

use App\Models\Setting;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        Setting::setValue('spire_username', 'Swiftcount', [
            'type' => 'string',
            'group' => 'spire',
            'label' => 'Spire Username',
            'is_encrypted' => false,
        ]);
    }

    public function down(): void
    {
        // Keep username; do not blank production credentials on rollback.
    }
};
