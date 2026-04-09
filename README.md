# Templator (Thunderbird)

## Load in Thunderbird

### Install a release (recommended)
1. Open the GitHub **Releases** page for this repository.
2. Download `templator.xpi` from the latest release (or use the stable URL  
   `https://github.com/OWNER/REPO/releases/latest/download/templator.xpi` after you replace `OWNER` and `REPO`).
3. In Thunderbird: `Tools` > `Add-ons and Themes` > gear icon > **Install Add-on From File…** and choose the `.xpi` file.

### Temporary load (development only)
1. Open Thunderbird.
2. Go to `Tools` > `Add-ons and Themes`.
3. Click the gear icon and choose `Debug Add-ons`.
4. Click `Load Temporary Add-on...` and select `manifest.json` from this folder.

## Publish a new version (maintainers)

1. Bump `"version"` in `manifest.json` (semver, e.g. `0.2.0`).
2. Commit and push to `main`.
3. Create and push a **git tag** that matches the manifest version with a `v` prefix:
   ```bash
   git tag v0.2.0
   git push origin v0.2.0
   ```
4. GitHub Actions builds the XPI, checks that the tag matches `manifest.json`, writes `updates.json`, and creates a **Release** with `templator.xpi`, a versioned copy, and `updates.json` attached.

Local build: `npm run build` produces `dist/templator.xpi` and `dist/templator-<version>.xpi`.

### Optional: automatic updates for users

Thunderbird can fetch updates from a hosted `updates.json`. Each release workflow generates `updates.json` with the correct `update_link` and `update_hash` for that release’s XPI.

1. Host `updates.json` at a **stable HTTPS URL** (for example: commit the file from the release assets to the repo default branch and use  
   `https://raw.githubusercontent.com/OWNER/REPO/main/updates.json`).
2. In `manifest.json`, under `browser_specific_settings.gecko`, add:
   ```json
   "update_url": "https://raw.githubusercontent.com/OWNER/REPO/main/updates.json"
   ```
3. After each release, update the committed `updates.json` with the asset from that release (or automate copying it into the repo).

For a wider audience, publishing signed builds on [Thunderbird Add-ons](https://addons.thunderbird.net/) is the usual approach; Mozilla hosts updates for you.

## Use
1. Open a new compose window.
2. Click the `Templator` button in the compose toolbar.
3. Pick a template, fill the fields, and click `Apply to compose`.

## Customize templates
Open `Tools` > `Add-ons and Themes` > your extension > `Preferences`, or click `Manage templates` in the popup.
Use the form editor to manage templates, fields, and the rich-text body. Use `{{field_id}}` placeholders in `subject` and `body`.
If you need to import/export JSON, open the **Advanced JSON** panel and apply it there.

Example field definition:
```json
{
  "id": "contact_name",
  "label": "Contact name",
  "type": "text",
  "required": true
}
```

### Dynamic select options (months)
You can generate month options automatically. The shorthand `"months"` selects the previous month and the current month (same as a range of one month before and none after):

```json
{
  "id": "report_month",
  "label": "Report month",
  "type": "select",
  "optionsDynamic": "months"
}
```

**Range preset** (recommended): include a sliding window of calendar months before and after the current month. Options are listed in chronological order (oldest first). In Preferences you can set months before/after, format, locale, and see a live preview.

```json
{
  "id": "report_month",
  "label": "Report month",
  "type": "select",
  "optionsDynamic": {
    "type": "months",
    "monthsBefore": 2,
    "monthsAfter": 1,
    "format": "monthYear",
    "locale": "pl-PL"
  }
}
```

**Advanced** (legacy `count` / `startOffset` / `step`):

```json
{
  "id": "report_month",
  "label": "Report month",
  "type": "select",
  "optionsDynamic": {
    "type": "months",
    "count": 4,
    "startOffset": 0,
    "step": -1,
    "format": "monthYear",
    "locale": "pl"
  }
}
```

`format` supports: `month`, `shortMonth`, `monthYear`, `shortMonthYear`.
`locale` supports any BCP-47 tag (e.g. `pl` or `pl-PL`).

## Contact placeholders
When composing a message to a contact in your address book, you can use:
- `{{contact.firstName}}`
- `{{contact.lastName}}`
- `{{contact.displayName}}`
- `{{contact.email}}`

Underscore variants also work: `{{contact_first_name}}`, etc.
