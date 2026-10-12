import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The architecture is enforced here, not in a document. Each rule has a test that names the
 * offending files, so a violation is found in the pull request and not a year later.
 *
 * Layers inside a domain (`src/domeinen/<name>/`), lowest first. A file may only import from its
 * own layer or a lower one. `api` and `service` are peers and may use each other's types; so are
 * `hooks`, `components` and `platform` (a device implementation of a `service`-layer port, e.g. a
 * native SDK a pure layer may not import — see `shared/platform/rn/**` for the same idea one level
 * up, for ports every domain shares).
 *
 *   domain  <  api, service  <  store  <  hooks, components, platform  <  screens
 */
const SRC = dirname(fileURLToPath(import.meta.url));
const DOMAINS_DIR = join(SRC, 'domeinen');

const LAYER_RANK: Record<string, number> = {
  domain: 0,
  api: 1,
  service: 1,
  store: 2,
  hooks: 3,
  components: 3,
  platform: 3,
  screens: 4,
};

/** Layers that must run in plain Node: no React, no React Native, no Expo. */
const PURE_LAYERS = new Set(['domain', 'api', 'service']);

const PLATFORM_PACKAGES = [
  /^react$/,
  /^react\//,
  /^react-native($|[-/])/,
  /^react-dom/,
  /^expo($|[-/])/,
  /^@expo\//,
  /^@react-native($|[-/])/,
  /^@react-navigation\//,
  /^@tanstack\/react-query$/,
];

type SourceFile = {
  path: string;
  /** Path relative to src, with forward slashes. */
  rel: string;
  isTest: boolean;
  imports: string[];
  domain: string | null;
  layer: string | null;
};

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const full = join(directory, name);
    if (name === 'node_modules') {
      return [];
    }
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const IMPORT_PATTERNS = [
  /\b(?:import|export)\s+(?:type\s+)?[^'";]*?\bfrom\s*['"]([^'"]+)['"]/g,
  /\bimport\s*['"]([^'"]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
];

function readImports(source: string): string[] {
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  return IMPORT_PATTERNS.flatMap((pattern) =>
    [...withoutComments.matchAll(pattern)].flatMap((match) => (match[1] ? [match[1]] : [])),
  );
}

function classify(path: string): Pick<SourceFile, 'domain' | 'layer'> {
  const parts = relative(DOMAINS_DIR, path).split(sep);
  if (parts[0] === '..' || parts.length < 2) {
    return { domain: null, layer: null };
  }
  const [domain, layer] = parts;
  return { domain: domain ?? null, layer: layer && layer in LAYER_RANK ? layer : null };
}

const files: SourceFile[] = walk(SRC)
  .filter((path) => /\.tsx?$/.test(path))
  .map((path) => ({
    path,
    rel: relative(SRC, path).split(sep).join('/'),
    isTest: /\.test\.tsx?$/.test(path) || path.startsWith(join(SRC, 'test') + sep),
    imports: readImports(readFileSync(path, 'utf8')),
    ...classify(path),
  }));

/** Where an import points to: a file inside src (without extension), or null for packages. */
function resolveLocal(from: SourceFile, specifier: string): string | null {
  if (specifier.startsWith('@/')) {
    return resolve(SRC, specifier.slice(2));
  }
  if (specifier.startsWith('.')) {
    return resolve(dirname(from.path), specifier);
  }
  return null;
}

function targetOf(
  from: SourceFile,
  specifier: string,
):
  | (Pick<SourceFile, 'domain' | 'layer'> & {
      local: boolean;
      isBarrel: boolean;
      isUiBarrel: boolean;
      underShared: boolean;
      underApp: boolean;
      underBootstrap: boolean;
    })
  | null {
  const absolute = resolveLocal(from, specifier);
  if (absolute === null) {
    return null;
  }
  const rel = relative(SRC, absolute).split(sep).join('/');
  const inDomains = rel.startsWith('domeinen/');
  const { domain, layer } = inDomains ? classify(absolute) : { domain: null, layer: null };
  const restOfDomain = inDomains ? rel.split('/').slice(2).join('/') : '';
  return {
    domain,
    layer,
    local: true,
    isBarrel: inDomains && ['', 'index', 'ui'].includes(restOfDomain),
    isUiBarrel: inDomains && restOfDomain === 'ui',
    underShared: rel.startsWith('shared/') || rel === 'shared',
    underApp: rel.startsWith('app/') || rel === 'app',
    underBootstrap: rel.startsWith('bootstrap/') || rel === 'bootstrap',
  };
}

const describeViolations = (violations: string[]) => violations.join('\n');

/** `domeinen/<name>/index.ts`: the public, plain-TypeScript face of a domain. */
const isDomainIndex = (file: SourceFile) => /^domeinen\/[^/]+\/index\.ts$/.test(file.rel);

/** The React Native side of a domain. */
const UI_LAYERS = new Set(['hooks', 'screens', 'components', 'platform']);

describe('architecture', () => {
  it('finds the source files (guards against an empty scan that passes trivially)', () => {
    expect(files.length).toBeGreaterThan(30);
    expect(files.some((file) => file.domain === 'auth' && file.layer === 'service')).toBe(true);
  });

  it('keeps the pure layers free of React, React Native and Expo', () => {
    const violations = files
      .filter(
        (file) =>
          !file.isTest &&
          ((file.layer !== null && PURE_LAYERS.has(file.layer)) || isDomainIndex(file)),
      )
      .flatMap((file) =>
        file.imports
          .filter((specifier) => PLATFORM_PACKAGES.some((pattern) => pattern.test(specifier)))
          .map((specifier) => `${file.rel} imports ${specifier}`),
      );

    expect(describeViolations(violations)).toBe('');
  });

  it('keeps the pure layers and the domain index files away from the React Native side of a domain', () => {
    const violations = files
      .filter(
        (file) =>
          !file.isTest &&
          ((file.layer !== null && PURE_LAYERS.has(file.layer)) || isDomainIndex(file)),
      )
      .flatMap((file) =>
        file.imports.flatMap((specifier) => {
          const target = targetOf(file, specifier);
          if (!target || target.domain === null) {
            return [];
          }
          const reachesUi =
            target.isUiBarrel || (target.layer !== null && UI_LAYERS.has(target.layer));
          return reachesUi ? [`${file.rel} imports ${specifier} (React Native side)`] : [];
        }),
      );

    expect(describeViolations(violations)).toBe('');
  });

  it('keeps shared code free of React, React Native and Expo, except its adapters and the query setup', () => {
    const violations = files
      .filter(
        (file) =>
          !file.isTest &&
          file.rel.startsWith('shared/') &&
          !file.rel.startsWith('shared/platform/rn/') &&
          !file.rel.startsWith('shared/ui/') &&
          // The one place the query library is configured.
          !file.rel.startsWith('shared/query/'),
      )
      .flatMap((file) =>
        file.imports
          .filter((specifier) => PLATFORM_PACKAGES.some((pattern) => pattern.test(specifier)))
          .map((specifier) => `${file.rel} imports ${specifier}`),
      );

    expect(describeViolations(violations)).toBe('');
  });

  it('only imports from the same layer or a lower one inside a domain', () => {
    const violations = files
      .filter((file) => !file.isTest && file.domain !== null && file.layer !== null)
      .flatMap((file) =>
        file.imports.flatMap((specifier) => {
          const target = targetOf(file, specifier);
          if (!target || target.domain !== file.domain || target.layer === null) {
            return [];
          }
          const from = LAYER_RANK[file.layer ?? ''] ?? 0;
          const to = LAYER_RANK[target.layer] ?? 0;
          return to > from
            ? [`${file.rel} (${file.layer}) imports the ${target.layer} layer: ${specifier}`]
            : [];
        }),
      );

    expect(describeViolations(violations)).toBe('');
  });

  it('reaches into another domain only through its index file', () => {
    const violations = files.flatMap((file) =>
      file.imports.flatMap((specifier) => {
        const target = targetOf(file, specifier);
        if (!target || target.domain === null || target.domain === file.domain) {
          return [];
        }
        return target.isBarrel
          ? []
          : [`${file.rel} imports ${specifier} (use the index of the domain)`];
      }),
    );

    expect(describeViolations(violations)).toBe('');
  });

  it('does not let domains or shared code depend on routes, bootstrap or each other in a circle', () => {
    const violations = files
      .filter((file) => !file.isTest && (file.domain !== null || file.rel.startsWith('shared/')))
      .flatMap((file) =>
        file.imports.flatMap((specifier) => {
          const target = targetOf(file, specifier);
          if (!target) {
            return [];
          }
          if (target.underApp || target.underBootstrap) {
            return [
              `${file.rel} imports ${specifier} (routes and bootstrap sit above the domains)`,
            ];
          }
          if (file.rel.startsWith('shared/') && target.domain !== null) {
            return [`${file.rel} imports ${specifier} (shared code must not know the domains)`];
          }
          return [];
        }),
      );

    expect(describeViolations(violations)).toBe('');
  });

  it('has no dependency cycle between domains', () => {
    const graph = new Map<string, Set<string>>();
    for (const file of files.filter(
      (candidate) => !candidate.isTest && candidate.domain !== null,
    )) {
      const edges = graph.get(file.domain ?? '') ?? new Set<string>();
      for (const specifier of file.imports) {
        const target = targetOf(file, specifier);
        if (target?.domain && target.domain !== file.domain) {
          edges.add(target.domain);
        }
      }
      graph.set(file.domain ?? '', edges);
    }

    const cycles: string[] = [];
    const visit = (node: string, trail: string[]): void => {
      if (trail.includes(node)) {
        cycles.push([...trail.slice(trail.indexOf(node)), node].join(' -> '));
        return;
      }
      for (const next of graph.get(node) ?? []) {
        visit(next, [...trail, node]);
      }
    };
    for (const node of graph.keys()) {
      visit(node, []);
    }

    expect([...new Set(cycles)].join('\n')).toBe('');
  });

  it('has an index file for every domain that others use', () => {
    const used = new Set(
      files.flatMap((file) =>
        file.imports.flatMap((specifier) => {
          const target = targetOf(file, specifier);
          return target?.domain && target.domain !== file.domain ? [target.domain] : [];
        }),
      ),
    );
    const missing = [...used].filter(
      (domain) => !files.some((file) => file.rel === `domeinen/${domain}/index.ts`),
    );

    expect(missing).toEqual([]);
  });

  it('never declares an enum (use a const object and a union type)', () => {
    const violations = files
      .filter((file) => !file.isTest)
      .filter((file) =>
        /^\s*(?:export\s+)?(?:const\s+)?enum\s+\w+/m.test(readFileSync(file.path, 'utf8')),
      )
      .map((file) => file.rel);

    expect(violations).toEqual([]);
  });

  it('keeps console output out of the source, except in the device adapters', () => {
    const violations = files
      .filter((file) => !file.isTest && !file.rel.startsWith('shared/platform/rn/'))
      .filter((file) =>
        /\bconsole\.(log|warn|error|info|debug)\b/.test(
          readFileSync(file.path, 'utf8')
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/^\s*\/\/.*$/gm, ''),
        ),
      )
      .map((file) => file.rel);

    expect(violations).toEqual([]);
  });
});
