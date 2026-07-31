<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Services\ErpOrderService;
use App\Services\SpireApiClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SettingController extends Controller
{
    public function __construct(private readonly ErpOrderService $orders) {}

    public function index(): JsonResponse
    {
        $settings = Setting::query()
            ->orderBy('group')
            ->orderBy('key')
            ->get()
            ->map(fn (Setting $setting) => [
                'id' => $setting->id,
                'key' => $setting->key,
                'value' => $setting->is_encrypted ? null : $setting->decoded_value,
                'has_value' => $setting->value !== null && $setting->value !== '',
                'type' => $setting->type,
                'group' => $setting->group,
                'label' => $setting->label,
                'is_encrypted' => $setting->is_encrypted,
            ]);

        return response()->json(['data' => $settings]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'settings' => ['required', 'array'],
            'settings.*.key' => ['required', 'string', 'exists:settings,key'],
            'settings.*.value' => ['nullable'],
        ]);

        foreach ($data['settings'] as $item) {
            $setting = Setting::query()->where('key', $item['key'])->first();
            if (! $setting) {
                continue;
            }

            if ($setting->is_encrypted && ($item['value'] === null || $item['value'] === '')) {
                continue;
            }

            Setting::setValue($item['key'], $item['value'] ?? '', [
                'type' => $setting->type,
                'group' => $setting->group,
                'label' => $setting->label,
                'is_encrypted' => $setting->is_encrypted,
            ]);
        }

        SpireApiClient::flushOrderCache();

        return $this->index();
    }

    public function testSpire(): JsonResponse
    {
        $result = $this->orders->testSpireConnection();

        return response()->json($result, ($result['success'] ?? false) ? 200 : 422);
    }
}
