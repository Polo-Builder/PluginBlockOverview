# Agent Instructions

* Project: Chrome extension that simplifies Google Search and reduces the use of AI-related search features.
* The extension modifies Google Search while keeping the native interface whenever possible.
* Prefer modifying existing Google elements over recreating or replacing them.
* Preserve native links, behavior, and selected states.
* Keep features independent: UI modifications, redirects, and settings should not unnecessarily depend on each other.
* Inspect and reuse existing project code before adding new code.
* Make targeted changes only. Avoid unrelated refactoring and unnecessary dependencies.
* Keep the extension lightweight, simple, and robust against minor Google DOM changes.
* Do not create or update README files unless explicitly requested.
