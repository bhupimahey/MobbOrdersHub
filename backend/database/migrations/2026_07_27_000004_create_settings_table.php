<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('settings')) {
            return;
        }

        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->string('key', 100)->unique();
            $table->text('value')->nullable();
            $table->string('type', 30)->default('string');
            $table->string('group', 50)->default('general');
            $table->string('label')->nullable();
            $table->boolean('is_encrypted')->default(false);
            $table->timestamps();

            $table->index('group');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('settings');
    }
};
