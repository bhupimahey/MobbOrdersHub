<?php

namespace App\Support;

/**
 * Hub company slugs → Spire company / database IDs.
 * MOBB and HHC data must never be mixed.
 */
final class SpireCompany
{
    public const DEFAULT_SLUG = 'mobb';

    /** @var array<string, string> */
    public const MAP = [
        'mobb' => 'MOB_MED2',
        'hhc' => 'HHC2',
    ];

    public static function resolveId(?string $slugOrId): string
    {
        $raw = trim((string) $slugOrId);
        if ($raw === '') {
            return self::MAP[self::DEFAULT_SLUG];
        }

        $slug = strtolower($raw);
        if (isset(self::MAP[$slug])) {
            return self::MAP[$slug];
        }

        $upper = strtoupper($raw);
        foreach (self::MAP as $id) {
            if ($id === $upper) {
                return $id;
            }
        }

        return self::MAP[self::DEFAULT_SLUG];
    }

    public static function isValidSlug(?string $slug): bool
    {
        return isset(self::MAP[strtolower(trim((string) $slug))]);
    }
}
