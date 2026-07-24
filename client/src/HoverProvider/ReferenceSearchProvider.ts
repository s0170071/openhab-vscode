import * as vscode from 'vscode'

/**
 * A single file location where an item name was found.
 */
export interface FileLocationRef {
    /** The file containing the reference */
    uri: vscode.Uri
    /** 0-based line number of the reference */
    line: number
    /** Trimmed line text, for context */
    preview: string
}

/**
 * All references found for a given item name, grouped by category.
 */
export interface ItemReferenceResult {
    /** Lines in *.items files where the item is declared */
    definitions: FileLocationRef[]
    /** Lines in *.rules files mentioning the item */
    rules: FileLocationRef[]
    /** Lines in *.sitemap files referencing the item (item=<name>) */
    sitemaps: FileLocationRef[]
    /** Lines in *.js automation scripts mentioning the item */
    scripts: FileLocationRef[]
}

/** Safety cap on matches collected per category, independent of display limits. */
const MAX_MATCHES_PER_CATEGORY = 200

/** Default excludes so we don't scan dependency/build folders. */
const DEFAULT_EXCLUDE = '**/{node_modules,.git,out,dist}/**'

/** Item type keywords that can start an item definition line in a *.items file. */
const ITEM_TYPE_PATTERN =
    '(?:Group|Color|Contact|DateTime|Dimmer|Image|Location|Number(?::[a-zA-Z]*)?|Player|Rollershutter|String|Switch)'

/**
 * Searches the current VS Code workspace for references to an openHAB item name
 * across *.items, *.rules, *.sitemap and *.js files.
 *
 * Results are cached per item name until explicitly invalidated (e.g. on file save).
 *
 * @author openHAB VSCode Extension
 */
export class ReferenceSearchProvider {
    private cache = new Map<string, ItemReferenceResult>()

    /**
     * Finds all references to the given item name in the workspace.
     *
     * @param itemName The item name to search for
     * @returns A promise resolving to the categorized reference locations
     */
    public findReferences(itemName: string): Promise<ItemReferenceResult> {
        const cached = this.cache.get(itemName)
        if (cached) return Promise.resolve(cached)

        return Promise.all([
            this._searchCategory(itemName, '**/*.items', isDefinitionLine),
            this._searchCategory(itemName, '**/*.rules', isWordMatch),
            this._searchCategory(itemName, '**/*.sitemap', isSitemapReference),
            this._searchCategory(itemName, '**/*.js', isWordMatch),
        ]).then(([definitions, rules, sitemaps, scripts]) => {
            const result: ItemReferenceResult = { definitions, rules, sitemaps, scripts }
            this.cache.set(itemName, result)
            return result
        })
    }

    /**
     * Invalidates cached results.
     *
     * @param itemName If provided, only this item's cache entry is cleared; otherwise the whole cache is cleared.
     */
    public invalidate(itemName?: string): void {
        if (itemName) {
            this.cache.delete(itemName)
        } else {
            this.cache.clear()
        }
    }

    /**
     * Searches all files matching the given glob for lines matching the given matcher function.
     */
    private _searchCategory(
        itemName: string,
        glob: string,
        matcher: (line: string, itemName: string) => boolean
    ): Promise<FileLocationRef[]> {
        return vscode.workspace.findFiles(glob, DEFAULT_EXCLUDE).then((uris) =>
            Promise.all(
                uris.map((uri) =>
                    vscode.workspace.fs.readFile(uri).then(
                        (bytes) => extractMatches(uri, bytes, itemName, matcher),
                        () => [] as FileLocationRef[]
                    )
                )
            ).then((perFile) => perFile.flat().slice(0, MAX_MATCHES_PER_CATEGORY))
        )
    }
}

/**
 * Extracts matching line references from a file's raw content.
 */
function extractMatches(
    uri: vscode.Uri,
    bytes: Uint8Array,
    itemName: string,
    matcher: (line: string, itemName: string) => boolean
): FileLocationRef[] {
    const text = Buffer.from(bytes).toString('utf8')
    const lines = text.split(/\r?\n/)
    const refs: FileLocationRef[] = []

    lines.forEach((line, index) => {
        if (!matcher(line, itemName)) return

        refs.push({ uri, line: index, preview: line.trim() })
    })

    return refs
}

/**
 * Escapes a string for safe use inside a RegExp.
 */
function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Matches a generic word-boundary occurrence of the item name.
 */
function isWordMatch(line: string, itemName: string): boolean {
    return new RegExp(`\\b${escapeRegExp(itemName)}\\b`).test(line)
}

/**
 * Matches a *.items definition line for the given item name,
 * e.g. `Switch FF_Bath_Light "Bathroom Light" <light>`.
 */
function isDefinitionLine(line: string, itemName: string): boolean {
    return new RegExp(`^\\s*${ITEM_TYPE_PATTERN}\\s+${escapeRegExp(itemName)}\\b`).test(line)
}

/**
 * Matches a *.sitemap `item=<name>` reference for the given item name.
 */
function isSitemapReference(line: string, itemName: string): boolean {
    return new RegExp(`\\bitem=${escapeRegExp(itemName)}\\b`).test(line)
}
