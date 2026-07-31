<?php

use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Route;

/*
| Serve the React SPA for all non-API routes.
| Build frontend first: npm run build (from repo root) or npm run build in frontend/
*/
Route::get('/{any?}', function () {
    $index = public_path('index.html');

    if (! File::exists($index)) {
        return response(
            'Frontend is not built yet. From the project root run: npm start   (or: cd frontend && npm run build)',
            503
        )->header('Content-Type', 'text/plain');
    }

    return response(File::get($index), 200)->header('Content-Type', 'text/html');
})->where('any', '^(?!api).*$');
