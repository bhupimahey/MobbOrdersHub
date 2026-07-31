<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('activity_logs')) {
            return;
        }

        Schema::create('activity_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('order_reference', 100);
            $table->foreignId('phase_id')->nullable()->constrained('order_phases')->nullOnDelete();
            $table->string('phase_code', 50)->nullable();
            $table->string('action', 100);
            $table->string('previous_status', 100)->nullable();
            $table->string('updated_status', 100)->nullable();
            $table->json('details')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->timestamps();

            $table->index('order_reference');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activity_logs');
    }
};
