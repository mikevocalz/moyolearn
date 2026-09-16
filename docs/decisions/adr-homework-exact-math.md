# Exact arithmetic for homework

Status: implemented checker; production assessment evidence repository added in ADR-119, migration not yet applied.
Date: 2026-09-16

## Problem

The old arithmetic parser discarded unsupported characters, so `2^3` could become `23`, `2x+2` could become `2+2`, and an empty answer could become zero. Its decimal tolerance could accept an approximation to an exact fraction.

## Decision

Use Cortex Compute Engine 0.128.12 behind a bounded, full-consumption parser. Source MathJSON preserves operation order and explicit fraction scope. Allow only integer literals, exact decimal-to-rational conversion, Add, Subtract, Multiply, Divide, Rational and Negate. Reject unknown identifiers, functions, malformed delimiters, ambiguous implicit multiplication, and unsupported notation.

Validate every expression before constructing an isolated engine. Reject nonfinite intermediate values before parent simplification. Compare canonical exact rational expressions with structural identity; do not round or use numeric tolerance. No generated code is executed.

Limits are 2,048 source characters, 128 nodes, depth 24, 64 digits per integer literal, and Cortex's cooperative 100 ms evaluation limit. These are implementation limits, not measured latency guarantees; the time limit is not process isolation.

## Authorization and pedagogy

A tool result is not permission to grade. The tool includes the supplied evidence revision as metadata. The authenticated assessment boundary requires owned current server evidence held through the transcript transaction. ADR-119 supplies that repository for server-issued practice problems; a photographed page still has no evidence row, so that lane returns an ungraded result even for a client claiming `verified`.

The post-turn reveal check now includes fraction, negative and simple LaTeX numeric answers. This remains a narrow deterministic backstop, not a proof that arbitrary prose or symbolic solutions are safe to reveal. Subject cells remain disabled without their evaluation records.

## Validation and limitations

Student-model tests cover exact fractions, large integers, decimals, division by zero, malformed expressions, unsupported symbols, structure limits and metadata. No algebra, equations, units, graphing, chemistry or executable student code is claimed. Node execution is verified; Hermes performance and release bundle-size measurements remain pending.
