/**
 * Plumbing primitives shared by the row schemas.
 *
 * Rows reach the code through two channels with different encodings:
 * - PostgREST (supabase-js on the phone and in the admin) sends timestamptz as
 *   ISO strings with an offset ("2026-09-05T10:00:00.123456+00:00"), numeric
 *   and bigint columns as JSON numbers;
 * - a Node driver on the server (postgres or pg) sends timestamptz as Date
 *   objects, numeric and bigint columns as strings.
 * The schemas below accept both encodings and always output one shape:
 * ISO strings for timestamps, JavaScript numbers for numeric and bigint.
 */
import { z } from 'zod'

export const UuidSchema = z.uuid()

/** timestamptz: ISO string with offset, or a Date; output is always an ISO string. */
export const IsoTimestampSchema = z.union([
  z.iso.datetime({ offset: true }),
  z.date().transform((date) => date.toISOString()),
])
export type IsoTimestamp = z.output<typeof IsoTimestampSchema>

const numberFromPgString = (value: unknown): unknown =>
  typeof value === 'string' && value.trim() !== '' ? Number(value) : value

/** numeric(p, s): JSON number or a numeric string; output is a finite number. */
export const PgNumericSchema = z.preprocess(numberFromPgString, z.number())

/** bigint / identity columns: JSON number, numeric string or bigint; output is a safe integer. */
export const PgBigIntSchema = z.preprocess(
  (value) => (typeof value === 'bigint' ? Number(value) : numberFromPgString(value)),
  z.int(),
)

/**
 * IANA timezone name such as "Europe/Paris", "UTC" or "America/Argentina/Buenos_Aires".
 * The format is checked here; the database does not validate the name further.
 */
export const IanaTimezoneSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z][A-Za-z0-9_+-]*(\/[A-Za-z0-9_+-]+)*$/, 'Fuseau horaire IANA attendu')

/** jsonb column read back as a JSON value. */
export const JsonSchema = z.json()
export type JsonValue = z.output<typeof JsonSchema>

/** Rounds to two decimals, the precision of numeric(5,2) and numeric(6,2) columns. */
export function arrondirCentiemes(valeur: number): number {
  return Math.round((valeur + Number.EPSILON) * 100) / 100
}
