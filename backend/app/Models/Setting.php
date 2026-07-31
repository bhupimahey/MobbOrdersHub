<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;

class Setting extends Model
{
    protected $fillable = [
        'key',
        'value',
        'type',
        'group',
        'label',
        'is_encrypted',
    ];

    /** @var array<string, mixed>|null */
    private static ?array $runtime = null;

    protected function casts(): array
    {
        return [
            'is_encrypted' => 'boolean',
        ];
    }

    public function getDecodedValueAttribute(): mixed
    {
        $raw = $this->attributes['value'] ?? null;

        if ($raw === null) {
            return null;
        }

        if ($this->is_encrypted) {
            try {
                $raw = Crypt::decryptString($raw);
            } catch (\Throwable) {
                return null;
            }
        }

        return match ($this->type) {
            'boolean' => filter_var($raw, FILTER_VALIDATE_BOOLEAN),
            'integer' => (int) $raw,
            'json' => json_decode($raw, true),
            default => $raw,
        };
    }

    public static function getValue(string $key, mixed $default = null): mixed
    {
        $all = static::allCached();

        return array_key_exists($key, $all) ? $all[$key] : $default;
    }

    /**
     * @return array<string, mixed>
     */
    public static function allCached(): array
    {
        if (self::$runtime !== null) {
            return self::$runtime;
        }

        self::$runtime = Cache::remember('settings:all', 300, function () {
            $map = [];
            foreach (static::query()->get() as $setting) {
                $map[$setting->key] = $setting->decoded_value;
            }

            return $map;
        });

        return self::$runtime;
    }

    public static function flushCache(): void
    {
        self::$runtime = null;
        Cache::forget('settings:all');
    }

    public static function setValue(string $key, mixed $value, array $meta = []): self
    {
        $setting = static::query()->firstOrNew(['key' => $key]);

        foreach ($meta as $field => $metaValue) {
            if (in_array($field, ['type', 'group', 'label', 'is_encrypted'], true)) {
                $setting->{$field} = $metaValue;
            }
        }

        $type = $setting->type ?: ($meta['type'] ?? 'string');
        $store = match ($type) {
            'boolean' => $value ? '1' : '0',
            'json' => is_string($value) ? $value : json_encode($value),
            default => (string) $value,
        };

        if ($setting->is_encrypted) {
            $store = Crypt::encryptString($store);
        }

        $setting->value = $store;
        $setting->save();
        static::flushCache();
        Cache::forget("setting:{$key}");

        return $setting;
    }
}
