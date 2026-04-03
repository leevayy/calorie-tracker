# Calorie Tracker — backend contract

This document mirrors the TypeScript + Zod definitions in `src/contracts/`. Implement the server so request/response bodies validate against those schemas (or generate OpenAPI from them).

**Conventions**

- JSON bodies, `Content-Type: application/json`.
- Dates: `YYYY-MM-DD` for calendar days; `generatedAt` / `updatedAt` / `createdAt` use RFC 3339 (`date-time`).
- Authenticated routes (except auth): `Authorization: Bearer <accessToken>`.
- All user-scoped data is isolated by the authenticated user id.

**Environment (frontend)**

- `VITE_API_BASE_URL` — optional origin (no trailing slash required). If unset, the app uses local tip logic only.

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

**Response:** `200` `UserProfileResponse` — `user`, `dailyCalorieGoal`, optional `weightKg`, `heightCm`, `preferredLanguage` (`en` \| `ru` \| `pl` \| `tt` \| `kk`), `nutritionGoal`, `aiModelPreference` (`deepseek` \| `qwen3`), `updatedAt`.

### `PATCH /me`

**Body:** `UpdateProfileRequest` — at least one of `dailyCalorieGoal`, `weightKg`, `heightCm`, `preferredLanguage`, `nutritionGoal`, `aiModelPreference`.

**Response:** `200` `UserProfileResponse`.

---

## Food log

### `GET /days/:day`

- `day` is `YYYY-MM-DD`.

**Response:** `200` `DayLogResponse` — `day`, `calorieGoal` (effective for that day), `totalCalories`, `meals` with arrays per `MealType` (`breakfast`, `lunch`, `dinner`, optional `snack`). Each item is `FoodEntryResponse`.

### `POST /days/:day/entries`

**Body:** `CreateFoodEntryBody` (`mealType`, food fields). The calendar day is taken from the path only.

**Response:** `201` `FoodEntryResponse`.

### `DELETE /entries/:entryId`

**Response:** `204`.

---

## History

### `GET /history?from=YYYY-MM-DD&to=YYYY-MM-DD`

**Response:** `200` `HistoryRangeResponse` — `from`, `to`, `days` (`DailyHistoryPoint`: `date`, `calories`, `goal`), optional `weeklyAverageCalories`.

**Rules:** `from` ≤ `to`. Aggregate `calories` per user per day from food entries; `goal` is the goal effective that day (or current profile if you do not version goals).

---

## Daily tip (personal + community)

### `POST /tips/daily`

**Auth:** required.

**Body:** `DailyTipRequest`

| Field | Description |
|--------|-------------|
| `date` | Calendar day the tip applies to (usually “today” in the user’s timezone). |
| `caloriesConsumedToday` | Sum of logged calories for `date` (client may send computed total; server should reconcile with DB). |
| `calorieGoal` | User’s daily calorie target for that context. |
| `macrosToday` | Aggregated `proteinG`, `carbsG`, `fatsG` for `date`. |
| `mealsSummary` | Counts of items per meal for `date` (breakfast/lunch/dinner, optional snack). |
| `clientTimeZone` | IANA zone id from the client (e.g. `Europe/Warsaw`) so the model can interpret “now” vs local midnight for `date`. |
| `localTimeHm` | Client’s local wall time on that day, `HH:mm` (24h), same instant as the request. |
| `preferredLanguage` | `en` \| `ru` \| `pl` \| `tt` \| `kk` — natural-language output for the tip. |

**Server responsibilities**

1. Load the user’s **profile** and **history** (recent days) from storage.
2. Load **anonymized aggregates** across users for a defined cohort (e.g. similar `dailyCalorieGoal` band, same locale/time bucket). Do not expose per-user data.
3. Produce a short natural-language `message` that references:
   - the user’s progress vs `calorieGoal` for `date`,
   - macro balance if useful,
   - optional comparison to cohort medians/averages (e.g. intake “by now” in the user’s timezone).

**Response:** `200` `DailyTipResponse`

| Field | Description |
|--------|-------------|
| `message` | Single tip string for the UI. |
| `generatedAt` | When the tip was computed. |
| `sourcesUsed` | Optional tags: `user_today`, `user_profile`, `user_history`, `community_aggregate`. |
| `communitySnapshot` | Optional: `sampleSize`, `avgCaloriesAtSameUtcOffset`, `avgProteinGAtSameUtcOffset`, `cohortLabel`. |

**Errors:** `400` invalid body; `401` missing/invalid token.

**Privacy:** Community fields must be aggregated with a minimum k-anonymity threshold (e.g. suppress or widen cohort if `sampleSize` is too small).

---

## AI food parse (chat)

### `POST /ai/parse-food`

**Auth:** required.

**Body:** `ParseFoodRequest` — `text` (user message), `preferredLanguage` (`en` \| `ru` \| `pl` \| `tt` \| `kk`) for food names and portion strings.

**Response:** `200` `ParseFoodResponse` — `suggestions`: array of `ParsedFoodSuggestion` (`name`, `calories`, `protein`, `carbs`, `fats`, `portion`).

**Errors:** `400`, `401`, `502` upstream AI/nutrition failure.

---

## Schema source of truth

Implementations should stay aligned with:

- `src/contracts/common.ts`
- `src/contracts/auth.ts`
- `src/contracts/profile.ts`
- `src/contracts/food-log.ts` (`CreateFoodEntryBody` for path-style create; `CreateFoodEntryRequest` when `day` is in the body)
- `src/contracts/history.ts`
- `src/contracts/daily-tip.ts`
- `src/contracts/ai-food.ts`

Use `*.parse()` / `safeParse()` on the server for input validation and optionally for serializing responses.
