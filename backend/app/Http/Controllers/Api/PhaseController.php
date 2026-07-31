<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\OrderPhase;
use Illuminate\Http\JsonResponse;

class PhaseController extends Controller
{
    public function index(): JsonResponse
    {
        $phases = OrderPhase::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->get();

        return response()->json(['data' => $phases]);
    }
}
