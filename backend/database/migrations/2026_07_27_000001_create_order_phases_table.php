<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('order_phases')) {
            return;
        }

        Schema::create('order_phases', function (Blueprint $table) {
            $table->id();
            $table->string('code', 50)->unique();
            $table->string('name', 100);
            $table->string('description', 500)->nullable();
            $table->unsignedTinyInteger('sort_order');
            $table->string('color', 30)->nullable();
            $table->string('icon', 50)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index('sort_order');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_phases');
    }
};
