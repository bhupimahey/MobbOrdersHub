<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ErpOrderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OrderController extends Controller
{
    public function __construct(private readonly ErpOrderService $orders) {}

    public function index(Request $request): JsonResponse
    {
        $filters = $request->only(['search', 'status', 'date_from', 'date_to']);

        return response()->json(
            $this->orders->listOrders($request->user(), $filters)
        );
    }

    public function show(string $orderId): JsonResponse
    {
        $order = $this->orders->getOrder($orderId);

        if (! $order) {
            return response()->json(['message' => 'Order not found.'], 404);
        }

        return response()->json(['data' => $order]);
    }

    public function status(string $orderId): JsonResponse
    {
        $status = $this->orders->getStatus($orderId);

        if (! $status) {
            return response()->json(['message' => 'Order status not found.'], 404);
        }

        return response()->json(['data' => $status]);
    }

    public function update(Request $request, string $orderId): JsonResponse
    {
        $payload = $request->validate([
            'action' => ['required', 'string', 'max:100'],
            'phase_code' => ['nullable', 'string', 'max:50'],
            'updated_status' => ['nullable', 'string', 'max:100'],
            'current_phase' => ['nullable', 'string', 'max:50'],
            'carrier' => ['nullable', 'string', 'max:100'],
            'tracking' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string'],
            'data' => ['nullable', 'array'],
        ]);

        $user = $request->user();

        if ($user->isStaff()) {
            $phaseCode = $payload['phase_code'] ?? $payload['current_phase'] ?? null;
            if ($phaseCode && ! in_array($phaseCode, $user->assignedPhaseCodes(), true)) {
                return response()->json([
                    'message' => 'You are not authorized to update this phase.',
                ], 403);
            }
        }

        $result = $this->orders->updateOrder($orderId, $payload, $user);

        if (! ($result['success'] ?? false)) {
            return response()->json($result, 502);
        }

        return response()->json($result);
    }

    public function dashboard(Request $request): JsonResponse
    {
        return response()->json(
            $this->orders->dashboardSummary($request->user())
        );
    }
}
