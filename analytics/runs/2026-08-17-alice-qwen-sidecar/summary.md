# Alice vs Qwen production-routing sidecar

**Status:** Accepted with Alice reliability errors - available-case metrics are descriptive

This is a matched routing diagnostic, not another prompt hypothesis. It sends the exact frozen production baseline prompt and the same 95 authentic USDA Foundation food-log messages to the live Alice route three times each (285 requests). The Qwen comparator is the already-frozen complete baseline arm; no Qwen calls are repeated.

## Route provenance

| Arm | Selector | Model ID | Endpoint host | Source |
|---|---|---|---|---|
| Qwen | qwen3 | qwen3-235b-a22b-fp8 | llm.api.cloud.yandex.net | frozen search artifact |
| Alice | alicegpt | aliceai-llm | llm.api.cloud.yandex.net | live production selector |

Both arms use temperature 0.1, the same production prompt hash, the same exact-100g user messages, the same response contract, and three repetitions per case.

## Results

| Metric | Qwen | Alice |
|---|---:|---:|
| Scorable / requested outputs | 285/285 | 283/285 |
| Complete cases across all repetitions | 95/95 | 93/95 |
| Calorie MAE (kcal/100g) | 17.551 | 21.039 |
| Protein MAE (g/100g) | 1.506 | 1.486 |
| Latency p50 (ms) | 7101.6 | 2124.8 |
| Latency p95 (ms) | 8243.9 | 2580.6 |

## Paired finding

- The artifact is accepted, but the all-95-case paired ratio and confidence interval are not calculated: 93/95 cases have all three scorable Alice repetitions. Available-case Alice MAE is retained as descriptive. No failed row is deleted, formatting-retried, or imputed.
- Protein ratio and confidence interval are not estimated from incomplete arms.
- Latency values remain descriptive; the all-case paired estimate stays unavailable.

The latency ratio is not a controlled intrinsic-speed comparison: Alice latency is measured now, while Qwen latency is reused from the earlier interleaved multi-arm search. Provider load and run context can differ.

## Interpretation boundary

The artifact is accepted even if Alice has model-format failures. In that case, Alice MAE is reported over the exact scorable/requested denominator as an available-case descriptive result, and the all-95-case paired ratio/CI is left null. Failed outputs remain reliability evidence; none are silently dropped, imputed, or re-requested after a local format failure.

The finding applies to this exact production prompt, route configuration, endpoint, dataset, and run date. It does not by itself prove that either model is universally better on mixed meals, free-form portions, other languages, or future model versions.
