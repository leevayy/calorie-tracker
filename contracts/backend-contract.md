# Calorie Tracker — backend contract

This document mirrors the TypeScript + Zod definitions in `src/contracts/`. Implement the server so request/response bodies validate against those schemas (or generate OpenAPI from them).

**Conventions**

- JSON bodies, `Content-Type: application/json`.
- Dates: `YYYY-MM-DD` for calendar days; `generatedAt` / `updatedAt` / `createdAt` use RFC 3339 (`date-time`).
- Authenticated routes (except auth): `Authorization: Bearer <accessToken>`.
- All user-scoped data is isolated by the authenticated user id.

**Environment (frontend)**

- `VITE_API_BASE_URL` — optional API origin (no trailing slash required). If unset, the app uses same-origin API requests.

---

## Auth

### `POST /auth/register`

**Body:** `RegisterRequest` — `email`, `password` (min 8 chars).

**Response:** `201` `AuthResponse` — `accessToken`, optional `refreshToken`, optional `expiresInSeconds`, `user` (`UserSummary`).

**Errors:** `409` email taken; `400` validation.

### `POST /auth/login`

**Body:** `LoginRequest` — `email`, `password`.

**Response:** `200` `AuthResponse`.

**Errors:** `401` invalid credentials.

### `POST /auth/refresh` (optional)

**Body:** `{ "refreshToken": string }`

**Response:** `200` `AuthResponse` (new tokens).

---

## Profile

### `GET /me`

**Response:** `200` `UserProfileResponse` — `user`, `dailyCalorieGoal`, optional `weightKg`, `heightCm`, `preferredLanguage` (`en` \| `ru` \| `pl` \| `tt` \| `kk`), `nutritionGoal`, `updatedAt`.

### `PATCH /me`

**Body:** `UpdateProfileRequest` — at least one of `dailyCalorieGoal`, `weightKg`, `heightCm`, `preferredLanguage`, `nutritionGoal`.

**Response:** `200` `UserProfileResponse`.

---

## Food log

### `GET /days/:day`

- `day` is `YYYY-MM-DD`.

**Response:** `200` `DayLogResponse` — `day`, `calorieGoal` (effective for that day), `totalCalories`, `meals` with arrays per `MealType` (`breakfast`, `lunch`, `dinner`, optional `snack`). Each item is `FoodEntryResponse`.

### `GET /food-suggestions?query=&limit=`

Searches the authenticated user's active food-entry history by name. Results keep distinct portions and nutrition configurations separate and are ranked by text relevance, usage count, then recency.

**Response:** `200` `HistoricalFoodSuggestionsResponse` — reusable stored food fields plus `usageCount` and `lastUsedDay`. Supplying the returned `mealSlug` when creating the copied entry avoids another AI slug-resolution request.

### `POST /days/:day/entries`

**Body:** `CreateFoodEntryBody` (`mealType`, food fields). The calendar day is taken from the path only.

**Response:** `201` `FoodEntryResponse`.

### `POST /entries/batch`

**Body:** `CreateFoodEntriesBody` — `{ "entries": CreateFoodEntryRequest[] }`. Each entry carries its own `day` and `mealType`, so one request may span calendar days and meals. The array must contain at least one entry.

**Response:** `201` `CreateFoodEntriesResponse` — `{ "entries": FoodEntryResponse[] }`, in request order.

**Atomicity:** Slugs are resolved before the database transaction begins. All entries are inserted in one transaction; if any insert fails, none are persisted.

### `POST /meals/duplicate`

Copies every active entry from one owned meal to an explicit destination day and meal.

**Body:** `DuplicateMealBody` — `sourceDay`, `sourceMealType`, `destinationDay`, and `destinationMealType`.

**Response:** `201` `DuplicateMealResponse` — `{ "entries": FoodEntryResponse[] }`, preserving source-entry order with new ids and the requested destination day and meal.

**Errors:** `400` invalid body; `404` no active source meal exists for the authenticated user. A meal belonging to another user is indistinguishable from a missing meal.

**Atomicity:** All source entries are copied in one transaction. Either every entry is created or none is persisted.

### `DELETE /entries/batch`

**Body:** `DeleteFoodEntriesBody` — `{ "entryIds": string[] }`, identifying every entry created by one logging submission.

**Response:** `200` `DeleteFoodEntriesResponse` — `{ "entries": FoodEntryResponse[] }` for the deleted group.

**Atomicity:** Every id must name an active entry owned by the authenticated user. The group is soft-deleted in one transaction; otherwise no entry is deleted and the response is `404`.

### `PATCH /entries/:entryId`

**Body:** `UpdateFoodEntryBody` — full editable replacement containing `day`, `mealType`, and food fields (`name`, nutrition values, optional `portion`). `mealSlug` is recomputed by the server from the updated name.

**Response:** `200` `FoodEntryResponse`.

**Errors:** `400` invalid id/body; `404` missing, deleted, or owned by another user.

### `DELETE /entries/:entryId`

Soft-deletes an active entry owned by the authenticated user.

**Response:** `200` `FoodEntryResponse` containing the complete deleted entry (without internal deletion metadata).

**Errors:** `400` invalid id; `404` missing, already deleted, or owned by another user.

### `POST /entries/:entryId/restore`

Restores a soft-deleted entry owned by the authenticated user.

**Response:** `200` `FoodEntryResponse`.

**Errors:** `400` invalid id; `404` missing, active, or owned by another user.

**Read rule:** Soft-deleted entries are excluded from day logs, frequent foods, and history.

---

## History

### `GET /history?from=YYYY-MM-DD&to=YYYY-MM-DD`

**Response:** `200` `HistoryRangeResponse` — `from`, `to`, `days` (`DailyHistoryPoint`: `date`, `calories`, `goal`), optional `weeklyAverageCalories`.

**Rules:** `from` ≤ `to`. Aggregate `calories` per user per day from food entries; `goal` is the goal effective that day (or current profile if you do not version goals).

---

## AI food parse (chat)

### `POST /ai/parse-food`

**Auth:** required.

**Body:** `ParseFoodRequest` — `text` (user message), `preferredLanguage` (`en` \| `ru` \| `pl` \| `tt` \| `kk`) for food names and portion strings, plus the user's local date/time zone and the app's default logging day/meal for resolving relative timing phrases.

**Response:** `200` `ParseFoodResponse` — `suggestions`: array of `ParsedFoodSuggestion` (`name`, `calories`, `protein`, `carbs`, `fats`, `portion`, `day`, `mealType`). Each suggestion's resolved `day` and `mealType` determine where an accepted food is logged.

**Errors:** `400`, `401`, `502` upstream AI/nutrition failure.

---

## AI food-entry correction

### `POST /ai/entries/:entryId/correction`

**Auth:** required. The server loads the active entry by both authenticated user id and `entryId`; client-supplied entry context is ignored.

**Body:** `CorrectFoodEntryRequest` — `instruction` (trimmed, 1–2000 characters) and `preferredLanguage`. Model selection is server configuration and is not part of the request.

**Response:** `200` `CorrectFoodEntryResponse` — `{ "draft": UpdateFoodEntryBody }`. The draft is complete and schema-validated, but this endpoint never persists it. The existing ownership-scoped `PATCH /entries/:entryId` remains the only Save operation.

**Proportional changes:** The AI classifies a scale factor; application code multiplies calories, protein, carbohydrates, fats, and fiber together. Portion changes only when the classified operation explicitly includes a new portion.

**Errors:** `400` invalid request/id; `401` unauthenticated; `404` missing, deleted, or another user's entry; `422` ambiguous/unsupported/invalid instruction; `502` provider failure or schema-invalid AI output.

---

## Schema source of truth

Implementations should stay aligned with:

- `src/contracts/common.ts`
- `src/contracts/auth.ts`
- `src/contracts/profile.ts`
- `src/contracts/food-log.ts` (`CreateFoodEntryBody` for path-style create; `CreateFoodEntryRequest` when `day` is in the body; batch create and full entry update schemas)
- `src/contracts/history.ts`
- `src/contracts/ai-food.ts`

Use `*.parse()` / `safeParse()` on the server for input validation and optionally for serializing responses.
