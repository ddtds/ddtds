/** An import statement and the local names it binds */
export type Import = Readonly<{ statement: string; locals: readonly string[] }>;

export function rawImport(statement: string, ...locals: string[]): Import {
  return { statement, locals };
}

/** The injected imports that bind none of the `taken` names; a fence's own import wins */
export function unshadowed(injected: readonly Import[], taken: readonly string[]): Import[] {
  return injected.filter(({ locals }) => !locals.some((local) => taken.includes(local)));
}
