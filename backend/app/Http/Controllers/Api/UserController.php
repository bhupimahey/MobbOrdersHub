<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class UserController extends Controller
{
    public function index(): JsonResponse
    {
        $users = User::query()
            ->with('phases')
            ->orderBy('name')
            ->get()
            ->map(fn (User $user) => $this->formatUser($user));

        return response()->json(['data' => $users]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $phaseIds = $data['phase_ids'] ?? [];
        unset($data['phase_ids']);

        $data['password'] = Hash::make($data['password']);
        $data['avatar_initials'] = $data['avatar_initials'] ?? $this->makeInitials($data['name']);
        $data['role'] = $data['role'] ?? User::ROLE_STAFF;

        $user = User::query()->create($data);

        if ($user->role === User::ROLE_STAFF) {
            $user->phases()->sync($phaseIds);
        }

        $user->load('phases');

        return response()->json(['data' => $this->formatUser($user)], 201);
    }

    public function show(User $user): JsonResponse
    {
        $user->load('phases');

        return response()->json(['data' => $this->formatUser($user)]);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $data = $this->validated($request, $user);
        $phaseIds = $data['phase_ids'] ?? null;
        unset($data['phase_ids']);

        if (! empty($data['password'])) {
            $data['password'] = Hash::make($data['password']);
        } else {
            unset($data['password']);
        }

        if (isset($data['name']) && empty($data['avatar_initials'])) {
            $data['avatar_initials'] = $this->makeInitials($data['name']);
        }

        $user->update($data);

        if ($user->role === User::ROLE_SUPER_ADMIN) {
            $user->phases()->sync([]);
        } elseif (is_array($phaseIds)) {
            $user->phases()->sync($phaseIds);
        }

        $user->load('phases');

        return response()->json(['data' => $this->formatUser($user)]);
    }

    public function destroy(User $user): JsonResponse
    {
        if ($user->isSuperAdmin() && User::query()->where('role', User::ROLE_SUPER_ADMIN)->count() <= 1) {
            return response()->json(['message' => 'Cannot delete the last Super Admin.'], 422);
        }

        $user->tokens()->delete();
        $user->delete();

        return response()->json(['message' => 'User deleted.']);
    }

    public function toggleActive(User $user): JsonResponse
    {
        if ($user->isSuperAdmin() && $user->is_active) {
            $activeAdmins = User::query()
                ->where('role', User::ROLE_SUPER_ADMIN)
                ->where('is_active', true)
                ->count();

            if ($activeAdmins <= 1) {
                return response()->json(['message' => 'Cannot deactivate the last active Super Admin.'], 422);
            }
        }

        $user->is_active = ! $user->is_active;
        $user->save();

        if (! $user->is_active) {
            $user->tokens()->delete();
        }

        $user->load('phases');

        return response()->json(['data' => $this->formatUser($user)]);
    }

    private function validated(Request $request, ?User $user = null): array
    {
        return $request->validate([
            'name' => [$user ? 'sometimes' : 'required', 'string', 'max:255'],
            'email' => [
                $user ? 'sometimes' : 'required',
                'email',
                'max:255',
                Rule::unique('users', 'email')->ignore($user?->id),
            ],
            'password' => [$user ? 'nullable' : 'required', Password::defaults()],
            'role' => ['nullable', Rule::in([User::ROLE_SUPER_ADMIN, User::ROLE_STAFF])],
            'job_title' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'avatar_initials' => ['nullable', 'string', 'max:10'],
            'is_active' => ['nullable', 'boolean'],
            'phase_ids' => ['nullable', 'array'],
            'phase_ids.*' => ['integer', 'exists:order_phases,id'],
        ]);
    }

    private function formatUser(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'job_title' => $user->job_title,
            'phone' => $user->phone,
            'avatar_initials' => $user->initials(),
            'is_active' => $user->is_active,
            'is_super_admin' => $user->isSuperAdmin(),
            'phase_ids' => $user->phases->pluck('id')->values(),
            'phases' => $user->phases->map(fn ($phase) => [
                'id' => $phase->id,
                'code' => $phase->code,
                'name' => $phase->name,
                'sort_order' => $phase->sort_order,
            ])->values(),
            'created_at' => $user->created_at?->toIso8601String(),
        ];
    }

    private function makeInitials(string $name): string
    {
        $parts = preg_split('/\s+/', trim($name)) ?: [];
        $initials = '';
        foreach (array_slice($parts, 0, 2) as $part) {
            $initials .= strtoupper(substr($part, 0, 1));
        }

        return $initials ?: 'U';
    }
}
