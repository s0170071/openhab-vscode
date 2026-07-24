import { Hover, MarkdownString, workspace } from 'vscode'

import * as utils from '../Utils/Utils'
import { ConfigManager } from '../Utils/ConfigManager'
import { OH_CONFIG_PARAMETERS } from '../Utils/types'
import { LogSearchProvider } from './LogSearchProvider'
import { ReferenceSearchProvider, FileLocationRef } from './ReferenceSearchProvider'

/**
 * Handles hover actions in editor windows.
 * Provides additional information for existing items and other entities.
 *
 * @author Jerome Luckenbach - Initial contribution
 * @author Patrik Gfeller - Replace axios with native fetch (#332)
 * @author Patrik Gfeller - Simplify URL request logging (#362)
 */
export class HoverProvider {
    /**
     * Array of known Items from the openHAB environment
     */
    private knownItems: string[] = []

    /**
     * Searches events.log / openhab.log for item state changes
     */
    private logSearch: LogSearchProvider = new LogSearchProvider()

    /**
     * Searches the workspace for item definitions and references
     */
    private referenceSearch: ReferenceSearchProvider = new ReferenceSearchProvider()

    /**
     * Regex for Thread::sleep() expression
     */
    public static THREAD_SLEEP_REGEX: RegExp = /(?<=sleep\()[0-9]{1,9}(?=\))/gm

    /**
     * Regex for all hover-relevant wordings
     */
    public static HOVERED_WORD_REGEX: RegExp = /(?<=sleep\()[0-9]{1,9}(?=\)){1}|(\w+){1}/gm

    /**
     * Only allow the class to call the constructor
     */
    public constructor() {
        this.updateItems()
    }

    /**
     * Checks hovered editor area for existing openHAB Items and provides some live data from rest api if aan item name is found.
     *
     *
     * @param hoveredText The currently hovered text part
     * @returns A thenable [Hover](Hover) object with live information or null if no item is found
     */
    public getHover(hoveredText: string, hoveredLine: string): Promise<Hover | null> | null {
        console.log(`Checking if text can get a hover information.`)

        console.debug(`Checking if => ${hoveredLine} <= includes a Thread::sleep()`)
        const lineMatch = hoveredLine.match(HoverProvider.THREAD_SLEEP_REGEX)

        if (lineMatch && lineMatch.length == 1) return this.getReadableThreadSleep(hoveredLine)

        console.debug(`Checking if => ${hoveredText} <= is a known Item now`)
        const isKnownItem = this.knownItems.includes(hoveredText)
        const logSearchEnabled = ConfigManager.get(OH_CONFIG_PARAMETERS.hover.showLogSearch) as boolean

        if (!isKnownItem && !logSearchEnabled) {
            console.log(`Nothing to hover, waiting...`)
            return null
        }

        return this.getComposedHover(hoveredText, isKnownItem)
    }

    /**
     * Composes the full hover: live/log state plus workspace reference sections.
     *
     * @param hoveredText The currently hovered text part
     * @param isKnownItem Whether the text is a known REST item
     * @returns A promise resolving to a [Hover](Hover) object, or null if nothing was found
     */
    private getComposedHover(hoveredText: string, isKnownItem: boolean): Promise<Hover | null> {
        const statePromise: Promise<MarkdownString | null> = isKnownItem
            ? this.getRestItemMarkdown(hoveredText)
            : this.getLogSearchMarkdown(hoveredText)

        return Promise.all([statePromise, this.getReferencesMarkdown(hoveredText)]).then(
            ([stateMarkdown, referencesMarkdown]) => {
                if (!stateMarkdown && !referencesMarkdown) return null

                const combined = new MarkdownString()
                combined.isTrusted = { enabledCommands: ['openhab.command.hover.openLocation'] }

                if (stateMarkdown) combined.appendMarkdown(stateMarkdown.value)
                if (stateMarkdown && referencesMarkdown) combined.appendMarkdown('\n\n---\n\n')
                if (referencesMarkdown) combined.appendMarkdown(referencesMarkdown.value)

                return new Hover(combined)
            }
        )
    }

    /**
     * Generates a human readable time string from the given *Thread::sleep()* time in millisenconds
     *
     * @param hoveredLine The complete hovered line for further processing
     * @returns A thenable [Hover](Hover) object with a readable sleeping time
     */
    private getReadableThreadSleep(hoveredLine: string): Promise<Hover> {
        let match: number = parseInt(hoveredLine.match(HoverProvider.THREAD_SLEEP_REGEX)[0])

        return new Promise((resolve, reject) => {
            let resultText = new MarkdownString()
            resultText.appendCodeblock(this.humanReadableDuration(match), 'openhab')

            resolve(new Hover(resultText))
        })
    }

    /**
     * Provides some live data from rest api if an item name is found.
     *
     * @param hoveredText The currently hovered text part
     * @returns A promise resolving to a [MarkdownString](MarkdownString) with live information, or null on error
     */
    private getRestItemMarkdown(hoveredText: string): Promise<MarkdownString | null> {
        const url = utils.getHost() + `/rest/items/${hoveredText}`
        try {
            const sanitizedUrl = new URL(url)
            sanitizedUrl.username = ''
            sanitizedUrl.password = ''
            console.log(`Requesting => ${sanitizedUrl.toString()} <= now`)
        } catch {
            console.log('Requesting openHAB item now')
        }
        const headers: Record<string, string> = {}

        if (ConfigManager.tokenAuthAvailable()) {
            headers['X-OPENHAB-TOKEN'] = ConfigManager.get(OH_CONFIG_PARAMETERS.connection.authToken) as string
        }

        return fetch(url, { headers })
            .then((response) => {
                if (!response.ok) throw Object.assign(new Error(response.statusText), { status: response.status })
                return response.json() as Promise<any>
            })
            .then((result) => {
                if (result.error) return null

                let resultText = new MarkdownString()

                // Show Member Information for Group Items too
                if (result.type === 'Group') {
                    resultText.appendCodeblock(`Item ${result.name} | ${result.state}`, 'openhab')
                    resultText.appendMarkdown(`##### Members:`)

                    result.members.forEach((member, key, result) => {
                        resultText.appendCodeblock(`Item ${member.name} | ${member.state}`, 'openhab')

                        // No newline after the last member information
                        if (!Object.is(result.length - 1, key)) {
                            resultText.appendText(`\n`)
                        }
                    })
                } else {
                    resultText.appendCodeblock(`${result.state}`, 'openhab')
                }

                return resultText
            })
            .catch(() => null)
    }

    /**
     * Falls back to searching events.log / openhab.log for the hovered expression's latest state,
     * when it is not a known REST item.
     *
     * @param hoveredText The currently hovered text part
     * @returns A promise resolving to a [MarkdownString](MarkdownString) with the log state, or null if not found
     */
    private getLogSearchMarkdown(hoveredText: string): Promise<MarkdownString | null> {
        return this.logSearch
            .searchLog(hoveredText)
            .then((result) => {
                if (!result) return null

                const resultText = new MarkdownString()

                if (result.itemName && result.state) {
                    resultText.appendCodeblock(`${result.itemName}: ${result.state}`, 'openhab')
                } else {
                    resultText.appendMarkdown(`Found in log:\n`)
                    resultText.appendCodeblock(result.rawLine, 'log')
                }

                return resultText
            })
            .catch((e) => {
                console.debug(`LogSearch failed for '${hoveredText}': ${e}`)
                return null
            })
    }

    /**
     * Builds the "Defined in" / "Used in Rules" / "Used in Sitemaps" / "Used in Scripts" sections
     * for the hovered item, based on the current workspace reference search.
     *
     * @param hoveredText The currently hovered text part
     * @returns A promise resolving to a [MarkdownString](MarkdownString) with the reference sections, or null if none are enabled/found
     */
    private getReferencesMarkdown(hoveredText: string): Promise<MarkdownString | null> {
        const showDefinitions = ConfigManager.get(OH_CONFIG_PARAMETERS.hover.showItemDefinition) as boolean
        const showRules = ConfigManager.get(OH_CONFIG_PARAMETERS.hover.showRuleReferences) as boolean
        const showSitemaps = ConfigManager.get(OH_CONFIG_PARAMETERS.hover.showSitemapReferences) as boolean
        const showScripts = ConfigManager.get(OH_CONFIG_PARAMETERS.hover.showScriptReferences) as boolean

        if (!showDefinitions && !showRules && !showSitemaps && !showScripts) return Promise.resolve(null)

        if (!workspace.workspaceFolders || workspace.workspaceFolders.length === 0) return Promise.resolve(null)

        return this.referenceSearch
            .findReferences(hoveredText)
            .then((result) => {
                const max = (ConfigManager.get(OH_CONFIG_PARAMETERS.hover.maxReferencesPerCategory) as number) || 10
                const resultText = new MarkdownString()
                let any = false

                if (showDefinitions) any = this.appendCategory(resultText, 'Defined in', result.definitions, max) || any
                if (showRules) any = this.appendCategory(resultText, 'Used in Rules', result.rules, max) || any
                if (showSitemaps) any = this.appendCategory(resultText, 'Used in Sitemaps', result.sitemaps, max) || any
                if (showScripts) any = this.appendCategory(resultText, 'Used in Scripts', result.scripts, max) || any

                return any ? resultText : null
            })
            .catch((e) => {
                console.debug(`Reference search failed for '${hoveredText}': ${e}`)
                return null
            })
    }

    /**
     * Appends a capped, clickable list of file locations for one reference category.
     *
     * @returns **true** if the category had at least one reference (and something was appended)
     */
    private appendCategory(resultText: MarkdownString, title: string, refs: FileLocationRef[], max: number): boolean {
        if (refs.length === 0) return false

        resultText.appendMarkdown(`\n\n**${title}** (${refs.length})\n\n`)

        refs.slice(0, max).forEach((ref) => {
            resultText.appendMarkdown(`- ${this.locationLink(ref)}\n`)
        })

        if (refs.length > max) {
            resultText.appendMarkdown(`- _+${refs.length - max} more_\n`)
        }

        return true
    }

    /**
     * Builds a Markdown command-link that jumps to the given file location.
     */
    private locationLink(ref: FileLocationRef): string {
        const relativePath = workspace.asRelativePath(ref.uri, false)
        const args = encodeURIComponent(JSON.stringify([ref.uri.toString(), ref.line]))

        return `[${relativePath}:${ref.line + 1}](command:openhab.command.hover.openLocation?${args})`
    }

    /**
     * Converts and formats a given millisecond duration into a readable format
     *
     * @param msDuration Duration for formatting
     * @returns Formatted readable Duration String
     */
    private humanReadableDuration(msDuration: number): string {
        const h = Math.floor(msDuration / 1000 / 60 / 60)
        const m = Math.floor((msDuration / 1000 / 60 / 60 - h) * 60)
        const s = Math.floor(((msDuration / 1000 / 60 / 60 - h) * 60 - m) * 60)
        const ms = msDuration - h * 3600 * 1000 - m * 60 * 1000 - s * 1000

        return `${h != 0 ? h + ' hours ' : ''}${m != 0 ? m + ' minutes ' : ''}${s != 0 ? s + ' seconds ' : ''}${ms != 0 ? ms + ' milliseconds ' : ''}`
    }

    /**
     * Update known Items array
     *
     * @returns A Promise that resolves to **true** when update was successful, **false** otherwise
     */
    public updateItems(): Promise<boolean> {
        const headers: Record<string, string> = {}

        if (ConfigManager.tokenAuthAvailable()) {
            headers['X-OPENHAB-TOKEN'] = ConfigManager.get(OH_CONFIG_PARAMETERS.connection.authToken) as string
        }

        return fetch(`${utils.getHost()}/rest/items`, { headers })
            .then((response) => {
                if (!response.ok) throw Object.assign(new Error(response.statusText), { status: response.status })
                return response.json() as Promise<any[]>
            })
            .then((result) => {
                // Clear possible existing array
                this.knownItems = []

                result.forEach((item) => {
                    this.knownItems.push(item.name)
                })

                console.log(`Updates Items for HoverProvider`)
                return true
            })
            .catch((error) => {
                console.error(`Failed to update Items for HoverProvider`, error)
                utils.appendToOutput(`Could not reload items for HoverProvider`)
                utils.handleRequestError(error)

                // Ensure knownItems is still an array even on error
                this.knownItems = []

                return false
            })
    }

    /**
     * Invalidates the cached workspace reference search results.
     * Should be called when *.items, *.rules, *.sitemap or *.js files change.
     */
    public invalidateReferenceCache(): void {
        this.referenceSearch.invalidate()
    }
}
