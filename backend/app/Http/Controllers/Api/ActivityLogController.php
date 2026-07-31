<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ActivityLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = ActivityLog::query()
            ->with(['user:id,name,email', 'phase:id,code,name'])
            ->latest();

        if ($search = $request->string('search')->toString()) {
            $query->where(function ($q) use ($search) {
                $q->where('order_reference', 'like', "%{$search}%")
                    ->orWhere('action', 'like', "%{$search}%")
                    ->orWhere('previous_status', 'like', "%{$search}%")
                    ->orWhere('updated_status', 'like', "%{$search}%");
            });
        }

        if ($userId = $request->integer('user_id')) {
            $query->where('user_id', $userId);
        }

        if ($phaseCode = $request->string('phase_code')->toString()) {
            $query->where('phase_code', $phaseCode);
        }

        $logs = $query->paginate($request->integer('per_page', 25));

        return response()->json($logs);
    }
}
