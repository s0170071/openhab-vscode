# openHAB VS Code Extension

[![Azure DevOps builds (branch)][ADOBuildBadgeImage]][ADOBuildBadgeImageLink]

[![Visual Studio Marketplace Downloads)][MarketplaceDownloadBadgeImage]][MarketplaceDownloadBadgeImageLink]
[![Open VSX Downloads][openVsxDownloadBadgeImage]][openVsxDownloadBadgeImageLink]

[openHAB](http://www.openhab.org) is a vendor and techology agnostic open source automation software for your home. This [Visual Studio Code](https://code.visualstudio.com) extension allows you to work with openHAB configuration files (like `*.items`, `*.rules`, `*.sitemap`, `*.script` and JavaScript automation files `*.js`) thanks to the syntax highlighting, code snippets and integrated search.

The extension is designed with openHAB 2.x in mind - most snippets and design patterns will work in openHAB 2.x

## This branch (`release/1.0.2`) vs. `main`

This branch is **not** part of the official `openhab/openhab-vscode` history. It's an integration build that combines feature branches which were submitted upstream as separate, independent pull requests (upstream maintainers asked for them to stay split, so they will **not** be merged together there). Compared to `main`, this branch adds:

| Feature                                      | Source PR                                                                                     | What it does                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Log-based hover state extraction             | [#381](https://github.com/openhab/openhab-vscode/pull/381)                                    | Hovering a variable (e.g. a rule-local name) that isn't a known Item falls back to searching `events.log` / `openhab.log` for its last value.                                                                                                                                                                                                                                                        |
| JS / sitemap hover tooltips + syntax updates | [#382](https://github.com/openhab/openhab-vscode/pull/382)                                    | Hovering `item=<name>` in `.js` automation scripts or `.sitemap` files shows the live Item state; sitemap widget syntax highlighting improved. This branch also includes an additional fix (not yet a separate upstream PR) so that `item=<name>` still resolves when the name is directly followed by a character like `{` with no whitespace in between (e.g. `item=gEHZStatistik{` in a sitemap). |
| Item hover reference navigation              | [#383](https://github.com/openhab/openhab-vscode/pull/383)                                    | Hovering an Item shows where it's **defined** and where it's **referenced** (Things, Rules, Sitemaps, Scripts), with jump-to and back-to-origin links.                                                                                                                                                                                                                                               |
| Hover word-boundary fix                      | [#384](https://github.com/openhab/openhab-vscode/pull/384) (pending, not yet merged upstream) | Fixes hovering a plain item name (outside of an `item=` attribute) directly followed by a non-word character with no whitespace in between — previously the hover silently failed to resolve.                                                                                                                                                                                                        |

Everything else (syntax highlighting, snippets, tree views, REST API integration, etc.) is unchanged from `main`.

> **Note:** PR [#384](https://github.com/openhab/openhab-vscode/pull/384) is still open upstream. Both it and the `item=` bracket fix above are already included directly in this branch (and in the bundled `openhab-1.0.2.vsix`), so you don't need to wait for anything to be merged to get them here.

## Features

- Syntax highlighting for the [openHAB DSL](https://www.openhab.org/docs/configuration/) (rules, items, scripts and sitemaps).
- Code snippets for openHAB, including [Design Patterns](https://community.openhab.org/tags/designpattern) by Rich Koshak
- Integrated quick search of [openHAB Community](https://community.openhab.org)
- Integrated Basic UI browser window (`Ctrl + Alt + O` or editor title icon)
- Integrated Paper UI preview for the Items and Things
- Integration with openHAB REST API
- List of all Items accessible from the tree view
- Code completions
- Language Server Protocol support - syntax validation
- Dynamic Items creation from Thing's channels
- Quick openHAB console access
- Add Items to Sitemap with one click
- Get live Item states while hovering over item names in the Editor
- Extract item states from `events.log` / `openhab.log`: hovering a variable like `geschlossenPrev` shows its value when found in the log with the format `geschlossenPrev="true"`
- Hover tooltips for item names in JavaScript automation files (`.js`) and sitemap files (`.sitemap`), including `item=<name>` references
- Hover over an item to see where it's defined and where it's used in Things, Rules, Sitemaps and Scripts, with jump-to links
- Show human readable `Thread::sleep()` times while hovering

### Log Hover Configuration

The extension can search openHAB log files to enhance hover tooltips for values that only exist transiently (e.g. rule variables). Configure the paths in VS Code settings:

| Setting                      | Default                                  | Description                         |
| ---------------------------- | ---------------------------------------- | ----------------------------------- |
| `openhab.log.eventsLogPath`  | `/opt/openhab/userdata/logs/events.log`  | Path to the openHAB events log      |
| `openhab.log.openhabLogPath` | `/opt/openhab/userdata/logs/openhab.log` | Path to the openHAB application log |

### Item Hover Reference Navigation Configuration

Controls what's shown when hovering an Item name (definition location, and where it's referenced across Things/Rules/Sitemaps/Scripts):

| Setting                                  | Default | Description                                                                                                                  |
| ---------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `openhab.hover.showItemDefinition`       | `true`  | Show the `.items` file location (under an `items/` folder) where the hovered item is defined.                                |
| `openhab.hover.showThingsReferences`     | `true`  | Show `.things` files (under a `things/` folder) that reference the hovered item.                                             |
| `openhab.hover.showRuleReferences`       | `true`  | Show `.rules` files (under a `rules/` folder) that reference the hovered item.                                               |
| `openhab.hover.showSitemapReferences`    | `true`  | Show `.sitemap` files (under a `sitemaps/` folder) that reference the hovered item (`item=<name>`).                          |
| `openhab.hover.showScriptReferences`     | `true`  | Show `.js` automation scripts (under an `automation/` folder) that reference the hovered item.                               |
| `openhab.hover.showLogSearch`            | `true`  | Fall back to searching `events.log` / `openhab.log` for a hovered expression's latest state when it isn't a known REST item. |
| `openhab.hover.maxReferencesPerCategory` | `10`    | Maximum number of file locations shown per reference category (definitions, rules, sitemaps, scripts).                       |

![openHAB2 code snippets](docs/images/openhab-demo.gif)

## Configuration

Learn more about the configuration options in our [documentation](https://github.com/openhab/openhab-vscode/blob/master/docs/USAGE.md) on github.

## Installing this build

This branch isn't published to the Marketplace or Open VSX. A pre-built package, `openhab-1.0.2.vsix`, is committed at the root of this branch. To install it:

```sh
code --install-extension openhab-1.0.2.vsix
```

Or in VS Code: open the Extensions view → `...` menu → **Install from VSIX...** → select `openhab-1.0.2.vsix`.

## Things Explorer demo

![Things Explorer](docs/images/openhab-things.gif)

## Sitemap Insert demo

![Quick insert Items into Sitemap](docs/images/openhab-sitemap-insert.gif)

## Known Issues

Check out [existing issues](https://github.com/openhab/openhab-vscode/issues) in the repository.

## Release Notes

See [CHANGELOG.md](https://github.com/openhab/openhab-vscode/blob/master/CHANGELOG.md) file for the details.

---

## Contributing

Everyone is invited to improve this extension.

Check out the extension code in our [GitHub repository](https://github.com/openhab/openhab-vscode/).
See [Contributing.md](https://github.com/openhab/openhab-vscode/blob/master/CONTRIBUTING.md) file for further technical and formal details for contributing something to the openHAB project.

### For More Information

- [openHAB Documentation](https://www.openhab.org/docs/)
- [openHAB Community](https://community.openhab.org)

**Enjoy!**

[ADOBuildBadgeImage]: https://img.shields.io/azure-devops/build/openhab/82e39b03-2e63-4a34-84ca-3cb57be32202/2/master?logo=azure-pipelines&logoColor=blue
[ADOBuildBadgeImageLink]: https://dev.azure.com/openhab/vscode-openhab/_build?definitionId=2
[ADOTestImage]: https://img.shields.io/azure-devops/tests/openhab/82e39b03-2e63-4a34-84ca-3cb57be32202/2/master?logo=azure-devops&logoColor=blue
[ADOTestImageLink]: https://dev.azure.com/openhab/vscode-openhab/_build?definitionId=2
[LicenseBadgeImage]: https://img.shields.io/badge/license-EPL%202-green.svg 'License Information'
[LicenseBadgeImageLink]: https://opensource.org/licenses/EPL-2.0
[MarketplaceRatingBadgeImage]: https://img.shields.io/visual-studio-marketplace/stars/openhab.openhab?color=orange&label=marketplace&logo=visual-studio-code&logoColor=blue 'Star rating'
[MarketplaceRatingBadgeImageLink]: https://marketplace.visualstudio.com/items?itemName=openhab.openhab&ssr=false#review-details
[MarketplaceDownloadBadgeImage]: https://img.shields.io/visual-studio-marketplace/d/openhab.openhab?logo=visual-studio-code&logoColor=blue
[MarketplaceDownloadBadgeImageLink]: https://marketplace.visualstudio.com/items?itemName=openhab.openhab
[openVsxDownloadBadgeImage]: https://img.shields.io/open-vsx/dt/openhab/openhab?label=Open%20VSX%20downloads&style=plastic
[openVsxDownloadBadgeImageLink]: https://open-vsx.org/extension/openhab/openhab
[GitHubReleaseBadge]: https://img.shields.io/github/v/release/openhab/openhab-vscode?include_prereleases 'latest by date including pre-releases'
[GitHubReleaseBadgeLink]: https://github.com/openhab/openhab-vscode/releases
