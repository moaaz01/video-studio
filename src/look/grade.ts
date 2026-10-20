/**
 * The generated grade: per-channel transfer curves plus a saturation scalar,
 * both derived from the app's palette by `scripts/lut.py`.
 *
 * This file is the only place that knows the shape of the JSON. Add a look in
 * `scripts/lut.py`, run it, and the filter exists — there is no second list.
 */
import gradeJson from "../generated/grade.json";

type Curve = number[];
export type Grade = {curves: {r: Curve; g: Curve; b: Curve}; saturate: number};

export const GRADES = gradeJson as unknown as Record<string, Grade>;

export const gradeFor = (name: string): Grade => GRADES[name] ?? GRADES["cinema-warm"];

export const gradeFilterId = (name: string) => `film-grade-${name}`;

/** tableValues wants a space-separated list; 4 decimals is below 8-bit precision. */
export const tableValues = (curve: Curve) => curve.map((v) => v.toFixed(4)).join(" ");
