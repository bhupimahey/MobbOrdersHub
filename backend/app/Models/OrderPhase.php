<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class OrderPhase extends Model
{
    protected $fillable = [
        'code',
        'name',
        'description',
        'sort_order',
        'color',
        'icon',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'user_phases', 'phase_id', 'user_id')
            ->withTimestamps();
    }
}
