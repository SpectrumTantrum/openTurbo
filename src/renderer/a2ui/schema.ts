export type Schema<T> = {
  readonly _tag: string;
  readonly check: (value: unknown, path: string) => { ok: true; value: T } | { ok: false; error: string };
};

export type Infer<T> = T extends Schema<infer U> ? U : never;

function fail(path: string, message: string): { ok: false; error: string } {
  return { ok: false, error: `${path || "<root>"}: ${message}` };
}

export const S = {
  string(): Schema<string> {
    return { _tag: "string", check: (v, p) => typeof v === "string" ? { ok: true, value: v } : fail(p, "expected string") };
  },
  number(): Schema<number> {
    return { _tag: "number", check: (v, p) => typeof v === "number" && Number.isFinite(v) ? { ok: true, value: v } : fail(p, "expected number") };
  },
  boolean(): Schema<boolean> {
    return { _tag: "boolean", check: (v, p) => typeof v === "boolean" ? { ok: true, value: v } : fail(p, "expected boolean") };
  },
  literal<L extends string | number | boolean>(literal: L): Schema<L> {
    return {
      _tag: "literal",
      check: (v, p) => v === literal ? { ok: true, value: literal } : fail(p, `expected literal ${JSON.stringify(literal)}`)
    };
  },
  enum<L extends readonly (string | number)[]>(values: L): Schema<L[number]> {
    return {
      _tag: "enum",
      check: (v, p) => values.includes(v as L[number]) ? { ok: true, value: v as L[number] } : fail(p, `expected one of ${values.join(", ")}`)
    };
  },
  optional<T>(inner: Schema<T>): Schema<T | undefined> {
    return {
      _tag: "optional",
      check: (v, p) => v === undefined ? { ok: true, value: undefined } : inner.check(v, p)
    };
  },
  array<T>(item: Schema<T>): Schema<T[]> {
    return {
      _tag: "array",
      check: (v, p) => {
        if (!Array.isArray(v)) return fail(p, "expected array");
        const out: T[] = [];
        for (let i = 0; i < v.length; i += 1) {
          const result = item.check(v[i], `${p}[${i}]`);
          if (!result.ok) return result;
          out.push(result.value);
        }
        return { ok: true, value: out };
      }
    };
  },
  object<F extends Record<string, Schema<unknown>>>(fields: F): Schema<{ [K in keyof F]: Infer<F[K]> }> {
    return {
      _tag: "object",
      check: (v, p) => {
        if (typeof v !== "object" || v === null || Array.isArray(v)) return fail(p, "expected object");
        const input = v as Record<string, unknown>;
        const out = {} as { [K in keyof F]: Infer<F[K]> };
        for (const key of Object.keys(fields)) {
          const result = fields[key].check(input[key], `${p}.${key}`);
          if (!result.ok) return result;
          (out as Record<string, unknown>)[key] = result.value;
        }
        for (const key of Object.keys(input)) {
          if (!(key in fields)) return fail(`${p}.${key}`, `unexpected field "${key}"`);
        }
        return { ok: true, value: out };
      }
    };
  }
};

export function validate<T>(schema: Schema<T>, value: unknown): { ok: true; value: T } | { ok: false; error: string } {
  return schema.check(value, "");
}
